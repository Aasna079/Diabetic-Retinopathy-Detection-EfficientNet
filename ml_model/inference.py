"""
inference.py
============
DR Detection Inference Engine — EfficientNet-B4 with CLAHE preprocessing.
"""

from email.mime import image

import cv2
import sys
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np

NUM_CLASSES = 5
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

CLASS_NAMES     = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
SEVERITY_LABELS = {0: "Normal", 1: "Low Risk", 2: "Moderate Risk",
                   3: "High Risk", 4: "Critical"}

RECOMMENDATIONS = {
    0: (
        "No diabetic retinopathy detected. Routine annual eye checkup recommended. "
        "Continue monitoring blood sugar levels as instructed by your physician."
    ),
    1: (
        "Mild non-proliferative DR detected. Follow-up with an ophthalmologist "
        "within 12 months is recommended. Please do not ignore this result — "
        "early-stage DR can progress if blood sugar is not well controlled."
    ),
    2: (
        "Moderate non-proliferative DR detected. Please refer this patient to an "
        "ophthalmologist within 3 to 6 months. The doctor should carefully review "
        "this case — moderate DR can progress to a sight-threatening stage. "
        "Do not delay if the patient reports any visual changes."
    ),
    3: (
        "SEVERE non-proliferative DR detected. URGENT ophthalmologist referral is "
        "required within days, not weeks. The doctor must examine this case carefully "
        "as there is a high risk of progression to Proliferative DR, which can cause "
        "permanent vision loss. Please do not dismiss or delay this referral."
    ),
    4: (
        "PROLIFERATIVE DR DETECTED. IMMEDIATE ACTION REQUIRED. This patient must be "
        "seen by an ophthalmologist as soon as possible. Proliferative DR carries a "
        "serious risk of blindness if not treated urgently. The doctor should treat "
        "this as a priority case and not wait. Laser treatment or anti-VEGF injection "
        "may be required."
    ),
}

PROLIFERATIVE_THRESHOLD = 0.30
SEVERE_THRESHOLD        = 0.35

SECOND_OPINION_NOTE = (
    "IMPORTANT: The AI model has detected a significant probability of a serious "
    "DR grade in this image. Even if the primary diagnosis appears lower-grade, "
    "the doctor should carefully re-examine this case. There is a possibility that "
    "a more severe condition may have been missed. A second clinical opinion or "
    "repeat imaging is strongly recommended before discharge."
)


def _load_metrics():
    """Read saved classification report and return per-class F1, precision, recall."""
    report_path = r"checkpoints\classification_report.txt"
    metrics = {}
    try:
        with open(report_path, "r") as f:
            lines = f.readlines()
        for line in lines:
            line_stripped = line.strip()
            for cls in CLASS_NAMES:
                if line_stripped.startswith(cls):
                    parts = line_stripped.split()
                    offset = len(cls.split())
                    metrics[cls] = {
                        "precision": float(parts[offset]),
                        "recall":    float(parts[offset + 1]),
                        "f1_score":  float(parts[offset + 2]),
                        "support":   int(parts[offset + 3]),
                    }
        for line in lines:
            if "accuracy" in line and "macro" not in line and "weighted" not in line:
                parts = line.strip().split()
                if len(parts) >= 2:
                    metrics["overall_accuracy"] = float(parts[1])
    except Exception as e:
        metrics["error"] = f"Could not load metrics: {str(e)}"
    return metrics


def apply_clahe(pil_img, clip_limit=2.0, tile_size=(8, 8)):
    img_bgr    = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    lab        = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b    = cv2.split(lab)
    clahe      = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_size)
    l_enhanced = clahe.apply(l)
    lab_merged = cv2.merge([l_enhanced, a, b])
    img_rgb    = cv2.cvtColor(cv2.cvtColor(lab_merged, cv2.COLOR_LAB2BGR),
                               cv2.COLOR_BGR2RGB)
    return Image.fromarray(img_rgb)


def _make_transform(size=380):
    return transforms.Compose([
        transforms.Resize((size, size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])


class DRInference:
    def __init__(self, checkpoint_path, use_tta=False):
        self.use_tta = use_tta
        self.device  = DEVICE

        self.model = models.efficientnet_b4(weights=None)
        in_features = self.model.classifier[1].in_features
        self.model.classifier = nn.Sequential(
            nn.Dropout(p=0.4, inplace=True),
            nn.Linear(in_features, NUM_CLASSES),
        )
        state = torch.load(checkpoint_path, map_location=self.device)
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        self.model.load_state_dict(state)
        self.model.to(self.device)
        self.model.eval()
        print(f"DRInference ready on {self.device}  |  TTA: {self.use_tta}")

        self.transform = _make_transform(380)
        self.tta_transforms = [
            _make_transform(380),
            transforms.Compose([transforms.Resize((380, 380)),
                transforms.RandomHorizontalFlip(p=1.0), transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])]),
            transforms.Compose([transforms.Resize((380, 380)),
                transforms.RandomVerticalFlip(p=1.0), transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])]),
            transforms.Compose([transforms.Resize((400, 400)),
                transforms.CenterCrop((380, 380)), transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])]),
            transforms.Compose([transforms.Resize((380, 380)),
                transforms.RandomRotation(degrees=(90, 90)), transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])]),
        ]

    def _infer(self, img, tfm):
        x = tfm(img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            return torch.softmax(self.model(x), dim=1).cpu().numpy()[0]

    def predict(self, image):
        img = image.convert("RGB")
        img = apply_clahe(img)

        probs = (
            np.mean([self._infer(img, t) for t in self.tta_transforms], axis=0)
            if self.use_tta else self._infer(img, self.transform)
        )

        class_id           = int(probs.argmax())
        confidence         = float(probs[class_id])
        prob_severe        = float(probs[3])
        prob_proliferative = float(probs[4])

        high_risk_flag = False
        warning        = None
        second_opinion = None

        if prob_proliferative >= PROLIFERATIVE_THRESHOLD:
            high_risk_flag = True
            warning = (
                f"URGENT: Proliferative DR probability is "
                f"{prob_proliferative:.1%}. Even though the primary prediction "
                f"is '{CLASS_NAMES[class_id]}', the doctor must not dismiss this. "
                f"Please carefully re-examine this image — a missed Proliferative "
                f"DR case can result in permanent blindness."
            )
            second_opinion = SECOND_OPINION_NOTE

        elif prob_severe >= SEVERE_THRESHOLD:
            high_risk_flag = True
            warning = (
                f"WARNING: Severe DR probability is {prob_severe:.1%}. "
                f"The primary prediction is '{CLASS_NAMES[class_id]}', but the "
                f"doctor should treat this as a potentially severe case. "
                f"Please do not rely solely on the AI result — clinical review "
                f"is essential here."
            )
            second_opinion = SECOND_OPINION_NOTE

        return {
            "class_id":       class_id,
            
            "class_name":     CLASS_NAMES[class_id],
            "severity":       SEVERITY_LABELS[class_id],
            "confidence":     round(confidence, 4),
            "probabilities":  {
                CLASS_NAMES[i]: round(float(p), 4) for i, p in enumerate(probs)
            },
            "recommendation": RECOMMENDATIONS[class_id],
            "high_risk_flag": high_risk_flag,
            "warning":        warning,
            "second_opinion": second_opinion,
            "model_metrics": _load_metrics().get(CLASS_NAMES[class_id], {})  ,
            "tta_used":       self.use_tta,
        }


# =============================================================================
#  MAIN — runs when you call: python inference.py <image_path>
# =============================================================================
if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("Usage: python inference.py <path_to_retinal_image>")
        print("Example: python inference.py C:\\images\\eye.png")
        sys.exit(1)

    image_path = sys.argv[1]
    checkpoint = r"D:\new\Dr_Project\checkpoints\best_model.pth"

    engine = DRInference(checkpoint, use_tta=False)
    result = engine.predict(image_path)

    print("\n" + "=" * 60)
    print("  DR INFERENCE RESULT")
    print("=" * 60)
    print(f"  Diagnosis      : {result['class_name']}")
    print(f"  Severity       : {result['severity']}")
    print(f"  Confidence     : {result['confidence'] * 100:.1f}%")
    print(f"  High Risk Flag : {result['high_risk_flag']}")
    print()
    print("  Probabilities:")
    for cls, prob in result["probabilities"].items():
        bar = "#" * int(prob * 40)
        print(f"    {cls:<20} {prob * 100:5.1f}%  {bar}")
    print()
    print("  Model Metrics:")
    for cls in CLASS_NAMES:
        if cls in result["model_metrics"]:
            m = result["model_metrics"][cls]
            print(f"    {cls:<20} P={m['precision']:.4f}  R={m['recall']:.4f}  F1={m['f1_score']:.4f}")
    if "overall_accuracy" in result["model_metrics"]:
        print(f"    {'Overall Accuracy':<20} {result['model_metrics']['overall_accuracy']:.4f}")
    print()
    print(f"  Recommendation:")
    print(f"  {result['recommendation']}")
    if result["warning"]:
        print()
        print(f"  WARNING:")
        print(f"  {result['warning']}")
    if result["second_opinion"]:
        print()
        print(f"  SECOND OPINION NOTE:")
        print(f"  {result['second_opinion']}")
    print("=" * 60)