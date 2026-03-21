from flask import Blueprint, request, jsonify
from datetime import datetime
import bcrypt

auth_bp = Blueprint('auth', __name__)

def init_auth(users_collection):

    @auth_bp.route('/api/signup', methods=['POST'])
    def signup():
        data = request.json

        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        role = data.get("role")
        nmc_number = data.get("nmc_number")

        if not name or not email or not password or not role:
            return jsonify({"error": "Missing required fields"}), 400
        
        if role == "doctor" and not nmc_number:
            return jsonify({"error": "NMC number required for doctors"}), 400

        existing_user = users_collection.find_one({"email": email})
        if existing_user:
            return jsonify({"error": "Email already registered"}), 400

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        user_data = {
            "name": name,
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "role": role,
            "nmc_number": nmc_number,
            "created_at": datetime.now()
        }

        users_collection.insert_one(user_data)

        return jsonify({"message": "User registered successfully"}), 201


    @auth_bp.route('/api/login', methods=['POST'])
    def login():
        data = request.json

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Missing email or password"}), 400

        user = users_collection.find_one({"email": email})

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
            return jsonify({"error": "Invalid credentials"}), 401

        return jsonify({
            "message": "Login successful",
            "user": {
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }
        }), 200

    return auth_bp