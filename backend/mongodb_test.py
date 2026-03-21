import certifi
from dotenv import load_dotenv
import os
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
#DATABASE_NAME = os.getenv("DATABASE_NAME")

try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000, tls=True, tlsCAFile=certifi.where())
    db = client["dr_detection_db"]
    print("✅ Connected successfully!")
    print("Collections:", db.list_collection_names())
except Exception as e:
    print("❌ Connection failed:", e)