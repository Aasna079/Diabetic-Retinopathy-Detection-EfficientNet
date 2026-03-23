"""
STEP 1: Data Cleaning & Resizing for Diabetic Retinopathy Detection
======================================================================
Expected dataset structure:
dataset/
  ├── 0/   (No DR)
  ├── 1/   (Mild DR)
  ├── 2/   (Moderate DR)
  ├── 3/   (Severe DR)
  └── 4/   (Proliferative DR)

OR a CSV file with columns: id_code, diagnosis (0-4)

Run: python clean_data.py
"""

import os
import cv2
import numpy as np
import pandas as pd
from pathlib import Path
from tqdm import tqdm
import logging
import hashlib
import json

# ─── CONFIG ────────────────────────────────────────────────────────────────────
RAW_DATA_DIR = r"D:\traingmodelds\aptos2019-blindness-detection\train_images"  # your raw images folder
CLEAN_DATA_DIR  = "../data/cleaned"     # output cleaned images
CSV_PATH = r"D:\traingmodelds\aptos2019-blindness-detection\train.csv"  # correct CSV path
IMAGE_SIZE      = (380, 380)            # EfficientNet-B4 optimal size
MIN_IMAGE_SIZE  = (100, 100)            # reject images smaller than this
MAX_ASPECT_RATIO = 3.0                  # reject extreme aspect ratios
BLUR_THRESHOLD  = 10.0                 # Laplacian variance — reject blurry images below this
SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}

CLASS_NAMES = {
    0: "No DR",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR"
}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# ─── HELPERS ───────────────────────────────────────────────────────────────────

def check_blur(img_gray):
    """Laplacian variance — low = blurry."""
    return cv2.Laplacian(img_gray, cv2.CV_64F).var()

def is_valid_retinal_image(img_bgr):
    """Check if retinal image has enough non-black pixels."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
    non_black = np.sum(thresh > 0)
    return non_black / thresh.size > 0.2

def ben_graham_preprocessing(img_bgr, sigmaX=10):
    """Enhance local contrast for retinal images."""
    img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img = cv2.addWeighted(
        img, 4,
        cv2.GaussianBlur(img, (0,0), sigmaX), -4,
        128
    )
    return img

def crop_black_borders(img_bgr, tolerance=7):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, tolerance, 255, cv2.THRESH_BINARY)
    coords = cv2.findNonZero(thresh)
    if coords is None:
        return img_bgr
    x, y, w, h = cv2.boundingRect(coords)
    return img_bgr[y:y+h, x:x+w]

def resize_and_pad(img_bgr, target_size):
    h, w = img_bgr.shape[:2]
    scale = min(target_size[0]/h, target_size[1]/w)
    new_h, new_w = int(h*scale), int(w*scale)
    resized = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    canvas = np.zeros((target_size[0], target_size[1], 3), dtype=np.uint8)
    y_off = (target_size[0]-new_h)//2
    x_off = (target_size[1]-new_w)//2
    canvas[y_off:y_off+new_h, x_off:x_off+new_w] = resized
    return canvas

def get_image_hash(img_path):
    with open(img_path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

# ─── DATASET LOADING ──────────────────────────────────────────────────────────

def load_dataset_paths():
    """Returns list of (image_path, label) tuples."""
    csv_file = Path(CSV_PATH)
    if not csv_file.exists():
        raise ValueError(f"CSV file not found at {CSV_PATH}")
    
    df = pd.read_csv(csv_file)
    pairs = []
    for _, row in df.iterrows():
        # Try multiple image extensions
        img_file = Path(RAW_DATA_DIR) / f"{row['id_code']}.png"
        if not img_file.exists():
            img_file = Path(RAW_DATA_DIR) / f"{row['id_code']}.jpeg"
        if not img_file.exists():
            img_file = Path(RAW_DATA_DIR) / f"{row['id_code']}.jpg"
        pairs.append((str(img_file), int(row['diagnosis'])))
    
    print(f"Found {len(pairs)} total images")
    return pairs

# ─── IMAGE PROCESSING ─────────────────────────────────────────────────────────

def process_single_image(img_path, label, out_dir, seen_hashes, stats):
    try:
        img_bgr = cv2.imread(str(img_path))
        if img_bgr is None:
            stats['corrupt'] += 1
            return False
        
        # Duplicate check
        h = get_image_hash(img_path)
        if h in seen_hashes:
            stats['duplicate'] += 1
            return False
        seen_hashes.add(h)

        # Minimum size check
        if img_bgr.shape[0] < MIN_IMAGE_SIZE[0] or img_bgr.shape[1] < MIN_IMAGE_SIZE[1]:
            stats['too_small'] += 1
            return False

        # Aspect ratio
        ar = max(img_bgr.shape[:2]) / min(img_bgr.shape[:2])
        if ar > MAX_ASPECT_RATIO:
            stats['bad_aspect'] += 1
            return False

        # Blur check
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        if check_blur(gray) < BLUR_THRESHOLD:
            stats['blurry'] += 1
            return False

        # Retinal image check
        if not is_valid_retinal_image(img_bgr):
            stats['invalid_retinal'] += 1
            return False

        # Crop & preprocess
        img_bgr = crop_black_borders(img_bgr)
        img_rgb = ben_graham_preprocessing(img_bgr)
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

        # Resize and save
        img_final = resize_and_pad(img_bgr, IMAGE_SIZE)
        class_dir = Path(out_dir) / str(label)
        class_dir.mkdir(parents=True, exist_ok=True)
        out_path = class_dir / (Path(img_path).stem + ".jpg")
        cv2.imwrite(str(out_path), img_final, [cv2.IMWRITE_JPEG_QUALITY, 95])
        stats['saved'] += 1
        return True
    except Exception as e:
        log.warning(f"Error processing {img_path}: {e}")
        stats['error'] += 1
        return False

# ─── CLEAN DATASET ───────────────────────────────────────────────────────────

def clean_dataset():
    pairs = load_dataset_paths()
    seen_hashes = set()
    stats = {k:0 for k in ['saved','corrupt','duplicate','too_small','bad_aspect','blurry','invalid_retinal','error']}
    class_counts = {i:0 for i in range(5)}

    Path(CLEAN_DATA_DIR).mkdir(parents=True, exist_ok=True)

    for img_path, label in tqdm(pairs, desc="Cleaning images"):
        if process_single_image(img_path, label, CLEAN_DATA_DIR, seen_hashes, stats):
            class_counts[label] += 1

    # Summary
    print("\n" + "="*60)
    print("  DATA CLEANING SUMMARY")
    print("="*60)
    for k,v in stats.items():
        print(f"  {k:<20}: {v}")
    print("\n  Class Distribution:")
    for cls_id, name in CLASS_NAMES.items():
        print(f"    {name:<25}: {class_counts[cls_id]}")
    print("="*60)

    # Save JSON summary
    summary = {'stats': stats, 'class_counts': class_counts}
    with open(Path(CLEAN_DATA_DIR)/"cleaning_summary.json","w") as f:
        json.dump(summary, f, indent=2)
    log.info(f"Cleaned data saved to: {CLEAN_DATA_DIR}")

# ─── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    clean_dataset()