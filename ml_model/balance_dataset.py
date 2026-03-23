import os
import shutil
import random
from pathlib import Path
from tqdm import tqdm
import cv2
import numpy as np

# ─── CONFIG ─────────────────────────────────────────────
CLEANED_DIR = "../data/cleaned"           # output of clean_data.py
BALANCED_DIR = "../data/cleaned_balanced" # new balanced dataset
CLASS_NAMES = {
    0: "No DR",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR"
}

TARGET_COUNT_PER_CLASS = {
    0: 600,   # reduce No DR to 600 samples
    1: 170,   # keep as is
    2: 476,   # keep as is
    3: 96,    # keep as is
    4: 148    # keep as is
}

AUGMENT = True  # whether to do simple augmentation for minority classes

# ─── SIMPLE AUGMENTATION ───────────────────────────────
def augment_image(img_path, out_path):
    """Simple augmentation: flip and rotate"""
    img = cv2.imread(str(img_path))
    imgs_to_save = [img]

    # Horizontal flip
    imgs_to_save.append(cv2.flip(img, 1))
    # Rotate 90
    imgs_to_save.append(cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE))
    # Rotate 180
    imgs_to_save.append(cv2.rotate(img, cv2.ROTATE_180))
    # Rotate 270
    imgs_to_save.append(cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE))

    # Save images
    for i, im in enumerate(imgs_to_save):
        new_name = f"{Path(out_path).stem}_aug{i}{Path(out_path).suffix}"
        cv2.imwrite(str(Path(out_path).parent / new_name), im)

# ─── BALANCING ─────────────────────────────────────────
def balance_dataset():
    Path(BALANCED_DIR).mkdir(parents=True, exist_ok=True)
    class_counts = {}

    for cls_id, cls_name in CLASS_NAMES.items():
        src_dir = Path(CLEANED_DIR) / str(cls_id)
        dst_dir = Path(BALANCED_DIR) / str(cls_id)
        dst_dir.mkdir(parents=True, exist_ok=True)

        images = list(src_dir.glob("*.jpg"))
        random.shuffle(images)

        target_count = TARGET_COUNT_PER_CLASS.get(cls_id, len(images))
        if len(images) > target_count:
            # Undersample
            selected = images[:target_count]
        else:
            selected = images

        # Copy selected images
        for img_path in selected:
            shutil.copy(img_path, dst_dir)

        class_counts[cls_id] = len(selected)

        # Optionally augment minority classes
        if AUGMENT and len(selected) < target_count:
            needed = target_count - len(selected)
            i = 0
            while i < needed:
                img_path = random.choice(selected)
                out_path = dst_dir / img_path.name
                augment_image(img_path, out_path)
                i += 4  # each augmentation creates 4 images

        class_counts[cls_id] = len(list(dst_dir.glob("*.jpg")))

    # Summary
    print("\nBALANCED DATASET SUMMARY")
    for cls_id, count in class_counts.items():
        print(f"{CLASS_NAMES[cls_id]:<25}: {count}")

if __name__ == "__main__":
    balance_dataset()