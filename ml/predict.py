import torch
from torchvision import transforms
from PIL import Image
import torch.nn as nn
from torchvision.models import resnet34, ResNet34_Weights
import sys
import os

# ===== Parameters =====
CHECKPOINT_PATH = "resnet34.pth"  # path to your trained model
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
NUM_CLASSES = 5
IMAGE_SIZE = 224

# ===== Transform for input image =====
transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),                         #converts to tensor
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ===== Load model =====
model = resnet34(weights=ResNet34_Weights.IMAGENET1K_V1)
model.fc = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(model.fc.in_features, NUM_CLASSES)
)
model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=DEVICE))
model = model.to(DEVICE)
model.eval()

# ===== Prediction function =====
def predict_image(image_path):
    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        return None
    image = Image.open(image_path).convert("RGB")
    image = transform(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        outputs = model(image)
        pred_class = torch.argmax(outputs, dim=1).item()
    return pred_class

# ===== Main =====
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict.py path_to_image")
        sys.exit(1)
    
    img_path = sys.argv[1]
    prediction = predict_image(img_path)
    if prediction is not None:
        print(f"Predicted DR Stage: {prediction}")