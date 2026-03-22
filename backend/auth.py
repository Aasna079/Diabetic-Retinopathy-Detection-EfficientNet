import uuid
from nanoid import generate
from flask import Blueprint, request, jsonify
import bcrypt
import smtplib
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv
from flask import make_response
from datetime import datetime, timedelta
import jwt


load_dotenv()  # loads variables from .env

sender_email = os.getenv("EMAIL_USER")
sender_password = os.getenv("EMAIL_PASS")

auth_bp = Blueprint('auth', __name__)

def send_email(to_email, short_id, role):
    subject = "Your Account ID"
    body = f"Your {role.capitalize()} ID is: {short_id}"

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

def generate_short_id(role):
    prefix = "DR" if role == "doctor" else "PT"
    return f"{prefix}-{generate(size=6)}"

def init_auth(users_collection, secret_key):

    @auth_bp.route('/api/signup', methods=['POST'])
    def signup():
        data = request.json

        name = data.get("name")
        email = data.get("email").strip().lower()
        password = data.get("password")
        role = data.get("role")

        nmc_number = None
        if role == "doctor":
            nmc_number = data.get("nmc_number")

        if not name or not email or not password or not role:
            return jsonify({"error": "Missing required fields"}), 400
        
        if role == "doctor" and not nmc_number:
            return jsonify({"error": "NMC number required for doctors"}), 400

        existing_user = users_collection.find_one({"email": email})
        if existing_user:
            return jsonify({"error": "Email already registered"}), 400

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        uuid_id = str(uuid.uuid4())

        short_id = generate_short_id(role)

        # ensure short_id is unique
        while users_collection.find_one({"short_id": short_id}):
            short_id = generate_short_id(role)

        user_data = {
            "name": name,
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "role": role,
            "nmc_number": nmc_number,
            "uuid": uuid_id,
            "short_id": short_id,
            "created_at": datetime.now()
        }

        users_collection.insert_one(user_data)

        # Send email AFTER saving
        try:
            send_email(email, short_id, role)
        except Exception as e:
            print("Email failed but user created:", e)

        token = jwt.encode({
            "email": email,
            "role": role,
            "exp": datetime.utcnow() + timedelta(days=7)
        }, secret_key, algorithm="HS256")

        response = make_response(jsonify({
            "message": "User registered successfully",
            "short_id": short_id,
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

    @auth_bp.route('/api/verify', methods=['POST'])
    def verify():
        data = request.json

        short_id = data.get("id")
        email = data.get("email").strip().lower()

        if not email or not short_id:
            return jsonify({"error": "Missing email or id"}), 400

        user = users_collection.find_one({
            "email": email,
            "short_id": short_id
        })

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "message": "User verified successfully"
        }), 200


    @auth_bp.route('/api/login', methods=['POST'])
    def login():
        data = request.json

        short_id = data.get("id")
        email = data.get("email").strip().lower()
        password = data.get("password")

        if not email or not password or not short_id:
            return jsonify({"error": "Missing email, id or password"}), 400

        user = users_collection.find_one({
            "email": email,
            "short_id": short_id
        })

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
            return jsonify({"error": "Invalid credentials"}), 401

        token = jwt.encode({
            "email": user["email"],
            "role": user["role"],
            "exp": datetime.utcnow() + timedelta(days=7)
        }, secret_key, algorithm="HS256")

        response = make_response(jsonify({
            "message": "Login successful",
            "user": {
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "id": user["short_id"]
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
                "email": decoded["email"]
            })

            if not user:
                return jsonify({"error": "User not found"}), 404

            return jsonify({
                "name": user.get("name"),
                "email": user.get("email"),
                "role": user.get("role"),
                "id": user.get("short_id"),
                "phone": user.get("phone"),
                "gender": user.get("gender"),
                "age": user.get("age"),
            })

        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401

        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401   

    return auth_bp