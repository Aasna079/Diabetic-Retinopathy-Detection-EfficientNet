import sys
import os
from flask import Flask, request, jsonify, send_from_directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from flask_cors import CORS
from datetime import datetime
from ml_model.inference import DRInference
from dotenv import load_dotenv
import numpy as np
from PIL import Image
import io
import uuid
import torch
import random
import torch.nn as nn
from torchvision import transforms
from torchvision import models
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
from pymongo import MongoClient
import certifi
import gridfs
from bson import ObjectId
from auth import init_auth, auth_bp
from admin import init_admin, admin_bp


print("=" * 60)
print("DIABETIC RETINOPATHY DETECTION API - PRESENTATION MODE")
print("=" * 60)

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

load_dotenv()

# Get environment variables
MONGODB_URI = os.getenv(
    "MONGODB_URI"
)
DATABASE_NAME = os.getenv("DATABASE_NAME", "dr_detection_db")
SECRET_KEY = os.getenv("SECRET_KEY", "my-super-secret-key-for-dr-detection-2024")
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "static/uploads")

print(f"📁 Upload folder: {UPLOAD_FOLDER}")
print(f"🗄️  Database: {DATABASE_NAME}")

# Create Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

# ========== MONGODB INIT ==========
print("\n🔗 Initializing MongoDB connection...")
mongo_client = None
db = None
fs = None
predictions_collection = None
mongodb_initialized = False

try:
    # Connect using the URI from .env with SSL verification
    mongo_client = MongoClient(
        MONGODB_URI,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000
        
    )
    mongo_client.admin.command('ping')
    print("✅ MongoDB Atlas connection successful!")

    db = mongo_client[DATABASE_NAME]
    fs = gridfs.GridFS(db)
    predictions_collection = db.predictions
    users_collection = db.users

    users_collection.create_index("email", unique=True) #if there is a duplicate email already, it will throw an error so manually delete those mails or use another logic for data collection

    mongodb_initialized = True

    # Show stats
    count = predictions_collection.count_documents({})
    print(f"📊 Existing predictions: {count}")

except Exception as e:
    print(f"⚠️  MongoDB connection failed: {e}")
    print("⚠️  Running in LOCAL MODE for presentation")
    mongodb_initialized = False

if mongodb_initialized:
    auth_bp = init_auth(users_collection, SECRET_KEY)
    app.register_blueprint(auth_bp)

    admin_bp = init_admin(users_collection)
    app.register_blueprint(admin_bp)  

# Check PyTorch
print(f"\n🤖 PyTorch version: {torch.__version__}")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"⚡ Using device: {'GPU' if torch.cuda.is_available() else 'CPU'}")

# ============= HELPER FUNCTIONS =============
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'bmp', 'gif'}

def get_risk_level(severity):
    risk_levels = {
        "No DR": "Very Low",
        "Mild": "Low",
        "Moderate": "Medium",
        "Severe": "High",
        "Proliferative": "Critical"
    }
    return risk_levels.get(severity, "Unknown")

def get_recommendations(severity):
    recommendations = {
        "No DR": [
            "Annual comprehensive eye exam",
            "Maintain HbA1c < 7.0%",
            "Control blood pressure",
            "Healthy diet & exercise",
            "Avoid smoking"
        ],
        "Mild": [
            "Follow-up in 6-12 months",
            "Tight glucose control",
            "Monitor for vision changes",
            "Regular BP monitoring",
            "Diabetes education"
        ],
        "Moderate": [
            "See specialist in 3-6 months",
            "Consider OCT imaging",
            "Evaluate for macular edema",
            "Intensify glucose control",
            "Discuss treatment options"
        ],
        "Severe": [
            "Urgent referral within 1 month",
            "Laser treatment (PRP) needed",
            "Monthly monitoring",
            "High risk of progression",
            "Coordinate with endocrinologist"
        ],
        "Proliferative": [
            "IMMEDIATE specialist consultation",
            "Laser therapy required urgently",
            "High vision loss risk",
            "Anti-VEGF injections likely",
            "Avoid strenuous activity"
        ]
    }
    return recommendations.get(severity, [
        "Consult ophthalmologist",
        "Complete medical evaluation",
        "Follow doctor's advice"
    ])

CHECKPOINT_PATH = os.path.join(BASE_DIR, "checkpoints", "best_model.pth")

MODEL_LOADED = False
engine = None

try:
    if os.path.exists(CHECKPOINT_PATH):
        print("\n📦 Loading DRInference engine...")

        engine = DRInference(CHECKPOINT_PATH, use_tta=False)

        MODEL_LOADED = True
        print("✅ ML Model loaded successfully!")

    else:
        print("⚠️ Model file not found, using demo mode")

except Exception as e:
    print(f"❌ Model loading error: {e}")
    print("⚠️  Using demo mode")

# ===== API ROUTES =====
@app.route('/')
def home():
    return jsonify({
        "app": "Diabetic Retinopathy Detection API",
        "version": "2.0",
        "status": "READY for presentation",
        "model_loaded": MODEL_LOADED,
        "database": "MongoDB Atlas" if mongodb_initialized else "Local Mode",
        "endpoints": {
            "GET /": "API information",
            "GET /health": "System health check",
            "POST /api/predict": "Upload retinal image for analysis",
            "GET /api/predictions": "Get all predictions",
            "GET /debug-data": "View all MongoDB data"
        }
    })
# ML classes
CLASS_NAMES = [
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative"
]

@app.route('/api/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files['image']
    doctor_name = request.form.get("doctor_name")

    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    image_bytes = file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    

    if MODEL_LOADED:
        result = engine.predict(image)

        patient_id = request.form.get("patient_id")
        doctor_id = request.form.get("doctor_id")  # if you send uuid from frontend

        prediction_data = {
            "class_id": result.get("class_id"),
            "class_name": result.get("class_name"),
            "confidence": result.get("confidence"),

            "severity": result.get("severity"),  # keep actual severity label

            "doctor_id": doctor_id,
            "patient_id": patient_id,
            "notes": "",

            "filename": file.filename,
            "stored_file": None,

            "prediction_id": str(uuid.uuid4()),

            "probabilities": result.get("probabilities"),
            "model_metrics": result.get("model_metrics", {}),

            "recommendation": result.get("recommendation"),

            "high_risk_flag": result.get("high_risk_flag"),
            "warning": result.get("warning"),
            "second_opinion": result.get("second_opinion"),

            "tta_used": result.get("tta_used"),

            "timestamp": datetime.now()
        }

    else:
        predicted_class = random.randint(0, 4)
        severity = CLASS_NAMES[predicted_class]
        confidence = round(random.uniform(0.6, 0.95), 4)

        prediction_data = {
            "severity": severity,
            "confidence": confidence,
            "risk_level": get_risk_level(severity),
            "recommendations": get_recommendations(severity)
        }
    
    # Save to MongoDB
    if mongodb_initialized:
        try:
            # Save image to GridFS
            image_id = fs.put(image_bytes, filename=file.filename)
            prediction_data["image_id"] = str(image_id)
            prediction_data["filename"] = file.filename
            prediction_data["timestamp"] = datetime.now()
            prediction_data["prediction_id"] = str(uuid.uuid4())  # generates a unique ID

            print("Saving to Mongo:", prediction_data)
            predictions_collection.insert_one(prediction_data)
        except Exception as e:
            print("⚠️ Failed to save to MongoDB:", e)

    # Prepare JSON-safe response
    response_data = prediction_data.copy()

    # Convert all ObjectIds to strings if present
    for key in ["_id", "image_id"]:
        if key in response_data:
            response_data[key] = str(response_data[key])

    # Safely convert timestamp to ISO string if exists
    if "timestamp" in response_data and isinstance(response_data["timestamp"], datetime):
        response_data["timestamp"] = response_data["timestamp"].isoformat()

    # Return JSON-safe response
    return jsonify(response_data)

#loading all the previous predictions
@app.route('/api/predictions', methods=['GET'])
def get_predictions():
    if not mongodb_initialized:
        return jsonify({"error": "Database not connected"}), 500

    try:
        all_predictions = []
        for pred in predictions_collection.find().sort("timestamp", -1):
            pred["_id"] = str(pred["_id"])
            if "image_id" in pred:
                pred["image_id"] = str(pred["image_id"])
            all_predictions.append(pred)
        return jsonify(all_predictions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/patient_reports', methods=['GET'])
def get_patient_reports():
    patient_id = request.args.get("patient_id")
    reports = list(predictions_collection.find({"patient_id": patient_id}))
    for r in reports:
        r["_id"] = str(r["_id"])
    return jsonify(reports)
    
@app.route("/api/patients", methods=["GET"])
def get_patients():
    doctor_id = request.args.get("doctor_id")
    if not mongodb_initialized:
        return jsonify([])
    patients = list(users_collection.find({"doctor_id": doctor_id}))
    for p in patients:
        p["_id"] = str(p["_id"])
    return jsonify(patients)

# ========== Chatbot Route ==========
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        message = data.get("message", "")
        reply = chatbot_reply(message)
        return jsonify({"reply": reply})
    except Exception as e:
        print("ERROR:", e)
        return jsonify({"reply": "Server error occurred."})

# Chatbot logic
def chatbot_reply(msg):
    if not msg:
        return "Please type a message."
    msg = msg.lower()
    if "login" in msg:
        return "Patients can log in using their registered email and password."
    elif "report" in msg:
        return "You can view your OCT report in the Reports section."
    elif "appointment" in msg:
        return "Appointments are listed in your dashboard."
    elif "hospital" in msg or "nearby" in msg:
        return "You can check nearby hospitals using the map section."
    elif "hello" in msg or "hi" in msg:
        return "Hello! How can I help you today?"
    else:
        return "I can help with login, reports, appointments, and navigation."


# ============= START SERVER ============
if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    print("\n" + "=" * 60)
    print("🚀 PRESENTATION MODE - READY FOR DEMO")
    print("=" * 60)
    print(f"\n📡 API Server: http://localhost:5000")
    print(f"📡 Health Check: http://localhost:5000/health")
    print(f"📡 Upload Image: POST http://localhost:5000/api/predict")
    print(f"📡 View Data: GET http://localhost:5000/debug-data")
    print(f"\n💾 Database: {'✅ MongoDB Atlas' if mongodb_initialized else '⚠️  Local Mode'}")
    print(f"🤖 ML Model: {'✅ Loaded' if MODEL_LOADED else '🎲 Demo Mode'}")
    print(f"⚡ Device: {device.upper()}")
    
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
