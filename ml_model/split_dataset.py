"""
STEP 2: Split Dataset & Build PyTorch DataLoaders
===================================================
Splits cleaned data → train / val / test (70/15/15)
Applies augmentation on train set.
Handles class imbalance with WeightedRandomSampler.

Run: python 02_prepare_splits.py
"""

import os, json, shutil, random
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import StratifiedShuffleSplit
from collections import Counter
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import transforms
from PIL import Image
import albumentations as A
from albumentations.pytorch import ToTensorV2

# ─── CONFIG ────────────────────────────────────────────────────────────────────
CLEAN_DATA_DIR = "../data/cleaned"
SPLITS_DIR     = "../data/splits"
IMAGE_SIZE     = 380
BATCH_SIZE     = 16          # reduce to 8 if GPU memory error
NUM_WORKERS    = 4
SEED           = 42

CLASS_NAMES = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]

# ─── GATHER ALL PATHS ──────────────────────────────────────────────────────────

def gather_paths():
    paths, labels = [], []
    for label in range(5):
        folder = Path(CLEAN_DATA_DIR) / str(label)
        if not folder.exists():
            continue
        for img_path in folder.glob("*.jpg"):
            paths.append(str(img_path))
            labels.append(label)
    return paths, labels


def create_splits():
    paths, labels = gather_paths()
    paths, labels = np.array(paths), np.array(labels)
    print(f"Total images: {len(paths)}")
    print("Class distribution:", Counter(labels))

    # 70/15/15 stratified split
    sss1 = StratifiedShuffleSplit(n_splits=1, test_size=0.30, random_state=SEED)
    train_idx, temp_idx = next(sss1.split(paths, labels))

    sss2 = StratifiedShuffleSplit(n_splits=1, test_size=0.50, random_state=SEED)
    val_idx, test_idx = next(sss2.split(paths[temp_idx], labels[temp_idx]))
    val_idx  = temp_idx[val_idx]
    test_idx = temp_idx[test_idx]

    splits = {
        'train': {'paths': paths[train_idx].tolist(), 'labels': labels[train_idx].tolist()},
        'val':   {'paths': paths[val_idx].tolist(),   'labels': labels[val_idx].tolist()},
        'test':  {'paths': paths[test_idx].tolist(),  'labels': labels[test_idx].tolist()},
    }

    Path(SPLITS_DIR).mkdir(parents=True, exist_ok=True)
    with open(Path(SPLITS_DIR) / "splits.json", "w") as f:
        json.dump(splits, f)

    print(f"\nSplits saved:")
    for split, data in splits.items():
        print(f"  {split}: {len(data['paths'])} images")
    return splits


# ─── TRANSFORMS ────────────────────────────────────────────────────────────────

def get_train_transforms():
    return A.Compose([
        A.Resize(IMAGE_SIZE, IMAGE_SIZE),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.RandomRotate90(p=0.5),
        A.Rotate(limit=30, p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
        A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=10, p=0.3),
        A.CLAHE(clip_limit=2.0, p=0.3),
        A.GaussNoise(var_limit=(10.0, 50.0), p=0.2),
        A.CoarseDropout(max_holes=8, max_height=20, max_width=20, p=0.2),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])

def get_val_transforms():
    return A.Compose([
        A.Resize(IMAGE_SIZE, IMAGE_SIZE),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])


# ─── DATASET CLASS ─────────────────────────────────────────────────────────────

class DRDataset(Dataset):
    def __init__(self, paths, labels, transform=None):
        self.paths = paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = Image.open(self.paths[idx]).convert("RGB")
        img = np.array(img)
        if self.transform:
            img = self.transform(image=img)["image"]
        return img, self.labels[idx]


# ─── WEIGHTED SAMPLER FOR CLASS IMBALANCE ──────────────────────────────────────

def make_weighted_sampler(labels):
    count = Counter(labels)
    total = len(labels)
    class_weights = {c: total / count[c] for c in count}
    sample_weights = [class_weights[l] for l in labels]
    return WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)


# ─── DATALOADER FACTORY ────────────────────────────────────────────────────────

def get_dataloaders(splits_path=None):
    if splits_path is None:
        splits_path = Path(SPLITS_DIR) / "splits.json"

    with open(splits_path) as f:
        splits = json.load(f)

    train_ds = DRDataset(splits['train']['paths'], splits['train']['labels'], get_train_transforms())
    val_ds   = DRDataset(splits['val']['paths'],   splits['val']['labels'],   get_val_transforms())
    test_ds  = DRDataset(splits['test']['paths'],  splits['test']['labels'],  get_val_transforms())

    sampler = make_weighted_sampler(splits['train']['labels'])

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                              num_workers=NUM_WORKERS, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=True)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=True)

    print(f"Train batches: {len(train_loader)} | Val: {len(val_loader)} | Test: {len(test_loader)}")
    return train_loader, val_loader, test_loader


if __name__ == "__main__":
    splits = create_splits()
    train_loader, val_loader, test_loader = get_dataloaders()
    print("DataLoaders ready!")
