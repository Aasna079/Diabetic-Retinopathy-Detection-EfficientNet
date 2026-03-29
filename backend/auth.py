import uuid
from flask import Blueprint, request, jsonify
import bcrypt
import os
from dotenv import load_dotenv
from flask import make_response
from datetime import datetime, timedelta
import jwt


load_dotenv()  # loads variables from .env


auth_bp = Blueprint('auth', __name__)


def init_auth(users_collection, secret_key):

    @auth_bp.route('/api/signup', methods=['POST'])
    def signup():
        data = request.json

        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        role = data.get("role")
        
        phone = None
        if role == "patient":
            phone = data.get("phone")

        nmc_number = None
        if role == "doctor":
            nmc_number = data.get("nmc_number")

        if not name or not email or not password or not role:
            return jsonify({"error": "Missing required fields"}), 400
        
        email = email.strip().lower()
        
        if role == "doctor" and not nmc_number:
            return jsonify({"error": "NMC number required for doctors"}), 400
        
        if role == "patient" and not phone:
            return jsonify({"error": "Phone number required for patients"}), 400

        existing_user = users_collection.find_one({"email": email})
        if existing_user:
            return jsonify({"error": "Email already registered"}), 400

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        uuid_id = str(uuid.uuid4())

        user_data = {
            "name": name,
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "role": role,
            "nmc_number": nmc_number,
            "phone": phone, 
            "uuid": uuid_id,
            "created_at": datetime.now()
        }
        if role == "patient":
            user_data["doctor_id"] = None

        try:
            users_collection.insert_one(user_data)
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

        token = jwt.encode({
            "email": email,
            "uuid": uuid_id,
            "role": role,
            "exp": datetime.utcnow() + timedelta(days=7)
        }, secret_key, algorithm="HS256")

        response = make_response(jsonify({
            "message": "User registered successfully",
            "role": role
        }))

        response.set_cookie(
            "token",
            token,
            httponly=True,
            secure=False,
            samesite="Lax",
            max_age=7 * 24 * 60 * 60
        )

        return response


    @auth_bp.route('/api/login', methods=['POST'])
    def login():
        data = request.json

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Missing email or password"}), 400
        
        email = email.strip().lower()

        user = users_collection.find_one({
            "email": email,
        })

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
            return jsonify({"error": "Invalid credentials"}), 401

        token = jwt.encode({
            "email": user["email"],
            "uuid": user["uuid"],
            "role": user["role"],
            "exp": datetime.utcnow() + timedelta(days=7)
        }, secret_key, algorithm="HS256")

        response = make_response(jsonify({
            "message": "Login successful",
            "user": {
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
            }
        }))

        response.set_cookie(
            "token",
            token,
            httponly=True,
            secure=False,  # True in production (HTTPS)
            samesite="Lax",
            max_age=7 * 24 * 60 * 60  # 7 days
        )

        return response

    @auth_bp.route('/api/me', methods=['GET'])
    def get_current_user():
        token = request.cookies.get("token")

        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            decoded = jwt.decode(token, secret_key, algorithms=["HS256"])

            user = users_collection.find_one({
                "uuid": decoded["uuid"]
            })

            if not user:
                return jsonify({"error": "User not found"}), 404

            return jsonify({
                "name": user.get("name"),
                "email": user.get("email"),
                "role": user.get("role"),
                "phone": user.get("phone"),
                "gender": user.get("gender"),
                "uuid": user.get("uuid"),
                "age": user.get("age"),
            })

        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401

        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401   

    @auth_bp.route("/api/patients", methods=["GET"])
    def get_patients():
        doctor_id = request.args.get("doctor_id")
        if not doctor_id:
            return jsonify({"error": "Missing doctor_id"}), 400

        patients = list(users_collection.find({"role": "patient", "doctor_id": doctor_id}))
        # Format response
        for p in patients:
            p["_id"] = str(p["_id"])
        return jsonify(patients)
    
    return auth_bp