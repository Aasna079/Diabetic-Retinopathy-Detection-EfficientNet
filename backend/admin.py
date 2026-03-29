from flask import Blueprint, request, jsonify
from datetime import datetime
import uuid
import secrets
import bcrypt
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv
load_dotenv()
import os

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

admin_bp = Blueprint('admin', __name__)

def init_admin(users_collection):

    @admin_bp.route("/api/admin/add_patient", methods=["POST"])
    def add_patient():
        """
        Admin adds a new patient and links to a doctor using doctor's NMC number
        """
        data = request.json
        name = data.get("name")
        email = data.get("email")
        phone = data.get("phone")
        doctor_nmc = data.get("doctor_nmc")  # Admin specifies doctor by NMC number
        set_password_token = secrets.token_urlsafe(16)

        if not name or not email or not phone or not doctor_nmc:
            return jsonify({"error": "Missing required fields"}), 400

        # Check if email already exists
        if users_collection.find_one({"email": email}):
            return jsonify({"error": "Email already exists"}), 400

        # Find the doctor by NMC number
        doctor = users_collection.find_one({"nmc_number": doctor_nmc, "role": "doctor"})
        if not doctor:
            return jsonify({"error": f"No doctor found with NMC '{doctor_nmc}'"}), 404
        
        def send_password_email(to_email, patient_name, token):
            link = f"http://localhost:3000/set-password?token={token}"  # frontend page
            msg_content = f"Hello {patient_name},\n\nPlease set your password using this link:\n{link}\n\nThis link will expire soon."
            msg = MIMEText(msg_content)
            msg['Subject'] = "Set Your Password"
            msg['From'] = EMAIL_USER
            msg['To'] = to_email

            try:
                with smtplib.SMTP("smtp.gmail.com", 587) as server:
                    server.starttls()
                    server.login(EMAIL_USER, EMAIL_PASS)
                    server.send_message(msg)
                print(f"Password email sent to {to_email}")
            except Exception as e:
                print("Email failed:", e)

        # Build the patient object
        patient_data = {
            "name": name,
            "email": email,
            "phone": phone,
            "role": "patient",
            "doctor_id": doctor["uuid"],  # link patient to doctor's UUID internally
            "nmc_number": None,
            "uuid": str(uuid.uuid4()),
            "set_password_token": set_password_token,
            "created_at": datetime.now()
        }

        try:
            result = users_collection.insert_one(patient_data)
            patient_data["_id"] = str(result.inserted_id)  # convert ObjectId to string
            send_password_email(patient_data["email"], patient_data["name"], set_password_token)
            return jsonify({
                "message": "Patient added successfully",
                "patient": patient_data,
                "linked_doctor": {"name": doctor["name"], "nmc_number": doctor["nmc_number"]}
            }), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @admin_bp.route("/api/admin/link_patient", methods=["POST"])
    def link_existing_patient():
        """
        Admin links an already registered patient to a doctor using patient's email and doctor's NMC number
        """
        data = request.json
        patient_email = data.get("patient_email")
        doctor_nmc = data.get("doctor_nmc")

        if not patient_email or not doctor_nmc:
            return jsonify({"error": "Missing required fields"}), 400

        # Find the patient by email
        patient = users_collection.find_one({"email": patient_email, "role": "patient"})
        if not patient:
            return jsonify({"error": f"No patient found with email '{patient_email}'"}), 404

        # Find the doctor by NMC number
        doctor = users_collection.find_one({"nmc_number": doctor_nmc, "role": "doctor"})
        if not doctor:
            return jsonify({"error": f"No doctor found with NMC '{doctor_nmc}'"}), 404

        # Update the patient's doctor_id
        try:
            users_collection.update_one(
                {"email": patient_email},
                {"$set": {"doctor_id": doctor["uuid"]}}
            )
            return jsonify({
                "message": f"Patient '{patient['name']}' linked to Doctor '{doctor['name']}' successfully",
                "patient_email": patient_email,
                "doctor_nmc": doctor_nmc
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @admin_bp.route("/api/patient/set_password", methods=["POST"])
    def set_password():
        data = request.json
        token = data.get("token")
        new_password = data.get("password")

        if not token or not new_password:
            return jsonify({"error": "Missing token or password"}), 400

        # Find patient by token
        patient = users_collection.find_one({"set_password_token": token})
        if not patient:
            return jsonify({"error": "Invalid or expired token"}), 404

        # Hash password
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())

        # Save password and remove token
        users_collection.update_one(
            {"uuid": patient["uuid"]},
            {"$set": {"password": hashed_password.decode('utf-8')},
            "$unset": {"set_password_token": ""}}
        )

        return jsonify({"message": "Password set successfully"}), 200

    return admin_bp

    