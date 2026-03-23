from dotenv import load_dotenv
load_dotenv(override=True)

import os, uuid
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image
import sys

sys.path.append(str(Path(__file__).parent))
from inference import DRInference  # Make sure this module is correctly defined
from db import Database

# ─── APP INIT ─────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder="static")
CORS(app)

UPLOAD_FOLDER   = Path(os.getenv("UPLOAD_FOLDER", "../data/uploads"))
CHECKPOINT_PATH = os.getenv("CHECKPOINT_PATH", "../checkpoints/best_model.pth")

UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}

# ── Load ML model ──────────────────────────────────────────────────────────────
print("Loading DR detection model...")
try:
    engine = DRInference(checkpoint_path=CHECKPOINT_PATH, use_tta=True)
    MODEL_LOADED = True
    print("✓ Model loaded successfully!")
except Exception as e:
    print(f"✗ Model loading failed: {e}")
    engine = None
    MODEL_LOADED = False

# ── Connect to MongoDB Atlas ───────────────────────────────────────────────────
try:
    db = Database()
    DB_CONNECTED = True
except Exception as e:
    print(f"✗ Database init failed: {e}")
    db = None
    DB_CONNECTED = False


# ─── HELPER ───────────────────────────────────────────────────────────────────
def _db_guard():
    """Return an error response tuple if DB is unavailable, else None."""
    if not db or not db.is_connected():
        return jsonify({"error": "Database not connected. Check MONGODB_URI in .env"}), 503
    return None


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok" if (MODEL_LOADED and DB_CONNECTED) else "degraded",
        "model_loaded": MODEL_LOADED,
        "db_connected": db.is_connected() if db else False,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    if not MODEL_LOADED:
        return jsonify({"error": "Model not loaded. Check server logs."}), 503

    # DB being down does NOT block predictions — just skips saving
    db_available = db and db.is_connected()

    if "image" not in request.files:
        return jsonify({"error": "No image provided. Use form-data key 'image'."}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "Empty filename."}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Unsupported format '{ext}'. Allowed: {ALLOWED_EXTENSIONS}"}), 400

    # ── Optional metadata ──────────────────────────────────────────────────────
    patient_id = request.form.get("patient_id") or None   # e.g. "P-00123"
    doctor_id = request.form.get("doctor_id") or None   # e.g. "DR-456"
    notes = request.form.get("notes", "")

    # ── Save upload ────────────────────────────────────────────────────────────
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    save_path = UPLOAD_FOLDER / filename
    file.save(str(save_path))

    try:
        # ── Run inference ──────────────────────────────────────────────────────
        result = engine.predict(str(save_path))

        # ── Build MongoDB record ───────────────────────────────────────────────
        record = {
            "prediction_id": file_id,
            "timestamp": datetime.now().isoformat(),
            "filename": file.filename,
            "stored_file": filename,
            # ── DR result ──────────────────────────────────────────────────────
            "class_id": result["class_id"],
            "class_name": result["class_name"],
            "severity": result["severity"],
            "confidence": result["confidence"],
            "probabilities": result["probabilities"],
            "recommendation": result["recommendation"],
            "tta_used": result["tta_used"],
            "model_metrics": result["model_metrics"],
            # ── Patient metadata ────────────────────────────────────────────────
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "notes": notes,
        }

        # ── Persist to MongoDB ─────────────────────────────────────────────────
        mongo_id = db.save_prediction(record)

        # ── Build API response (thumbnail as base64) ───────────────────────────
        # Remove _id that MongoDB injected into record dict during insert_one
        record.pop("_id", None)
        response_data = {**record, "mongo_id": mongo_id} 


        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


@app.route("/api/history", methods=["GET"])
def get_history():
    """
    Query params:
      limit      int   (default 50)
      skip       int   (default 0)
      class_id   int   filter by DR class (0–4)
      patient_id str   filter by patient ID
      doctor_id  str   filter by doctor ID
    """
    err = _db_guard()
    if err:
        return err

    try:
        limit = int(request.args.get("limit", 50))
        skip = int(request.args.get("skip", 0))
        class_id = request.args.get("class_id")
        patient_id = request.args.get("patient_id")
        doctor_id = request.args.get("doctor_id")

        class_id = int(class_id) if class_id is not None else None

        result = db.get_predictions(
            limit=limit, skip=skip,
            class_id=class_id, patient_id=patient_id, doctor_id=doctor_id,
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": f"Invalid query param: {e}"}), 400


@app.route("/api/history/<prediction_id>", methods=["GET"])
def get_single_prediction(prediction_id):
    err = _db_guard()
    if err:
        return err

    record = db.get_prediction_by_id(prediction_id)
    if not record:
        return jsonify({"error": f"No record found for id '{prediction_id}'"}), 404
    return jsonify(record), 200


@app.route("/api/history/<prediction_id>", methods=["DELETE"])
def delete_prediction(prediction_id):
    err = _db_guard()
    if err:
        return err

    success = db.delete_prediction(prediction_id)
    if success:
        return jsonify({"message": "Record deleted", "prediction_id": prediction_id}), 200
    return jsonify({"error": f"No record found for id '{prediction_id}'"}), 404


@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    err = _db_guard()
    if err:
        return err

    stats = db.get_statistics()
    return jsonify(stats), 200


@app.route("/api/patient/<patient_id>", methods=["GET"])
def get_patient_history(patient_id):
    err = _db_guard()
    if err:
        return err

    records = db.get_patient_history(patient_id)
    return jsonify({"patient_id": patient_id, "total": len(records), "data": records}), 200


@app.route("/", methods=["GET"])
def index():
    static_path = Path(__file__).parent / "static" / "index.html"
    if static_path.exists():
        return send_from_directory(str(Path(__file__).parent / "static"), "index.html")
    return jsonify({
        "message": "DR Detection API is running.",
        "model_loaded": MODEL_LOADED,
        "db_connected": db.is_connected() if db else False,
    })


# ─── CLEANUP ──────────────────────────────────────────────────────────────────
import atexit

@atexit.register
def shutdown():
    if db:
        db.close()


# ─── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  DR Detection API  —  MongoDB Atlas Edition")
    print(f"  Model loaded : {MODEL_LOADED}")
    print(f"  DB connected : {db.is_connected() if db else False}")
    print(f"  Uploads dir  : {UPLOAD_FOLDER.resolve()}")
    print(f"  Running at   : http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("DEBUG", "False").lower() == "true")