import uuid
from flask import Blueprint, request, jsonify
from datetime import datetime
import bcrypt
import smtplib
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv
from grpc import server

load_dotenv()  # loads variables from .env

sender_email = os.getenv("EMAIL_USER")
sender_password = os.getenv("EMAIL_PASS")

auth_bp = Blueprint('auth', __name__)

def send_email(to_email, unique_id):
    subject = "Your Doctor ID"
    body = f"Your Unique ID is: {unique_id}"

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = to_email

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
    except Exception as e:
        print("Email failed:", e)
        raise e   # THIS will show real error in terminal

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

        unique_id = str(uuid.uuid4())

        user_data = {
            "name": name,
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "role": role,
            "nmc_number": nmc_number,
            "unique_id": unique_id,
            "created_at": datetime.now()
        }

        users_collection.insert_one(user_data)

        # Send email AFTER saving
        send_email(email, unique_id)

        return jsonify({
            "message": "User registered successfully",
            "unique_id": unique_id
        }), 201


    @auth_bp.route('/api/login', methods=['POST'])
    def login():
        data = request.json

        unique_id = data.get("id")
        email = data.get("email")
        password = data.get("password")

        if not email or not password or not unique_id:
            return jsonify({"error": "Missing email, id or password"}), 400

        user = users_collection.find_one({
            "email": email,
            "unique_id": unique_id
        })

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
            return jsonify({"error": "Invalid credentials"}), 401

        return jsonify({
            "message": "Login successful",
            "user": {
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "id": user["unique_id"]
            }
        }), 200

    return auth_bp