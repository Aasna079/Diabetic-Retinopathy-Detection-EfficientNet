from dotenv import load_dotenv
load_dotenv(override=True)
'''database.py - MongoDB Atlas connection and operations for DR detection predictions'''
import os
import certifi
from pymongo import MongoClient, DESCENDING
from bson import ObjectId

MONGODB_URI   = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "dr_detection_db")


class Database:
    def __init__(self):
        # Connect to MongoDB Atlas with SSL
        self.client = MongoClient(
    MONGODB_URI,
    tls=True,
    tlsCAFile=certifi.where(),
    tlsAllowInvalidCertificates=True,
    serverSelectionTimeoutMS=10000
)

        # Test connection
        self.client.admin.command("ping")

        self.db = self.client[DATABASE_NAME]
        print(f"✅  MongoDB connected | DB: {DATABASE_NAME}")

        col = self.db["predictions"]

        # Creating indexes
        col.create_index("prediction_id", unique=True)
        col.create_index("patient_id")
        col.create_index("doctor_id")
        col.create_index("class_id")
        col.create_index([("timestamp", DESCENDING)])

    # ─────────────────────────────────────────────

    def is_connected(self):
        """Check if MongoDB is still connected."""
        try:
            self.client.admin.command("ping")
            return True
        except Exception:
            return False

    # ─────────────────────────────────────────────
    # Safe serializer (handles ObjectId properly)
    # ─────────────────────────────────────────────

    @staticmethod
    def _serialize(doc):
        """Safe serializer to convert MongoDB documents with ObjectId to JSON."""
        if not doc:
            return doc

        doc = dict(doc)

        if "_id" in doc and isinstance(doc["_id"], ObjectId):
            doc["_id"] = str(doc["_id"])

        return doc

    # ─────────────────────────────────────────────

    def save_prediction(self, record):
        """Save prediction to MongoDB and return the inserted ID."""
        result = self.db["predictions"].insert_one(record)
        return str(result.inserted_id)

    # ─────────────────────────────────────────────

    def get_predictions(self, limit=50, skip=0,
                        class_id=None, patient_id=None, doctor_id=None):
        """Get predictions from MongoDB based on query parameters."""
        col = self.db["predictions"]
        query = {}

        if class_id is not None:
            query["class_id"] = class_id
        if patient_id is not None:
            query["patient_id"] = patient_id
        if doctor_id is not None:
            query["doctor_id"] = doctor_id

        cursor = (
            col.find(query)
            .sort("timestamp", DESCENDING)
            .skip(skip)
            .limit(limit)
        )

        records = [self._serialize(r) for r in cursor]

        return {
            "data": records,
            "total": col.count_documents(query),
            "skip": skip,
            "limit": limit
        }

    # ─────────────────────────────────────────────

    def get_prediction_by_id(self, prediction_id):
        """Fetch a single prediction by its prediction_id."""
        doc = self.db["predictions"].find_one({"prediction_id": prediction_id})
        return self._serialize(doc)

    # ─────────────────────────────────────────────

    def get_patient_history(self, patient_id):
        """Fetch all predictions for a specific patient."""
        cursor = (
            self.db["predictions"]
            .find({"patient_id": patient_id})
            .sort("timestamp", DESCENDING)
        )

        return [self._serialize(r) for r in cursor]

    # ─────────────────────────────────────────────

    def delete_prediction(self, prediction_id):
        """Delete a prediction by its prediction_id."""
        result = self.db["predictions"].delete_one(
            {"prediction_id": prediction_id}
        )
        return result.deleted_count > 0

    # ─────────────────────────────────────────────

    def get_statistics(self):
        """Fetch statistics about the predictions (class distribution, recent predictions)."""
        col = self.db["predictions"]

        pipeline = [
            {
                "$group": {
                    "_id": "$class_id",
                    "class_name": {"$first": "$class_name"},
                    "count": {"$sum": 1},
                    "avg_confidence": {"$avg": "$confidence"},
                }
            },
            {"$sort": {"_id": 1}},
            {
                "$project": {
                    "_id": 0,
                    "class_id": "$_id",
                    "class_name": 1,
                    "count": 1,
                    "avg_confidence": {
                        "$round": ["$avg_confidence", 4]
                    },
                }
            },
        ]

        recent = col.find().sort("timestamp", DESCENDING).limit(5)

        return {
            "total_predictions": col.count_documents({}),
            "class_distribution": list(col.aggregate(pipeline)),
            "recent_predictions": [self._serialize(r) for r in recent],
        }

    # ─────────────────────────────────────────────

    def close(self):
        """Close the MongoDB connection."""
        self.client.close()
        print("MongoDB connection closed.")