import torch
from PIL import Image
import numpy as np
import gradio as gr
from ml_model.inference import DRInference
import os

# ===================== MODEL LOADING =====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKPOINT_PATH = os.path.join(BASE_DIR, "checkpoints", "best_model.pth")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
engine = None

if os.path.exists(CHECKPOINT_PATH):
    print("📦 Loading DRInference engine...")
    engine = DRInference(CHECKPOINT_PATH, use_tta=False)
    print("✅ Model loaded!")
else:
    print("⚠️ Model not found. Using demo mode.")

CLASS_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]

# ===================== HELPER FUNCTIONS =====================
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
        "No DR": ["Annual eye exam", "Maintain HbA1c < 7%", "Healthy diet & exercise"],
        "Mild": ["Follow-up in 6-12 months", "Tight glucose control"],
        "Moderate": ["See specialist in 3-6 months", "Consider OCT imaging"],
        "Severe": ["Urgent referral within 1 month", "Laser treatment needed"],
        "Proliferative": ["IMMEDIATE specialist consultation", "Laser therapy required urgently"]
    }
    return recommendations.get(severity, ["Consult ophthalmologist"])

# ===================== PREDICTION FUNCTION =====================
def predict(image: Image.Image):
    if engine:
        result = engine.predict(image)
        severity = result.get("severity", result.get("class_name"))
        confidence = result.get("confidence")
    else:
        # demo random prediction
        import random
        severity = random.choice(CLASS_NAMES)
        confidence = round(random.uniform(0.6, 0.95), 2)
    
    return {
        "Severity": severity,
        "Confidence": f"{confidence*100:.2f}%",
        "Risk Level": get_risk_level(severity),
        "Recommendations": "\n".join(get_recommendations(severity))
    }

# ===================== GRADIO INTERFACE =====================
iface = gr.Interface(
    fn=predict,
    inputs=gr.Image(type="pil"),
    outputs=[
        gr.Textbox(label="Severity"),
        gr.Textbox(label="Confidence"),
        gr.Textbox(label="Risk Level"),
        gr.Textbox(label="Recommendations")
    ],
    title="Diabetic Retinopathy Detection",
    description="Upload a retinal fundus image and get DR severity, risk, and recommendations."
)

if __name__ == "__main__":
    iface.launch()