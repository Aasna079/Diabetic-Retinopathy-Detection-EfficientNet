"""
evaluate.py
===========
Loads best_model.pth and computes Precision, Recall, F1-Score.


"""

import os
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm
from sklearn.metrics import classification_report
from training import (
    CFG, CLASS_NAMES, DEVICE,
    preprocess_and_save, balance_classes, make_splits,
    build_model, DRDataset, get_val_transforms,   # ← correct names
)

best_path = os.path.join(CFG["checkpoint_dir"], CFG["checkpoint_name"])

# ── 1. Load cached splits ──────────────────────────────────────────────────
print("Loading cached data splits...")
pairs = preprocess_and_save(CFG["raw_img_dir"], CFG["csv_path"], CFG["clahe_dir"])
pairs = balance_classes(pairs)
_, _, test_pairs = make_splits(pairs)

# ── 2. Build test loader directly (no sampler needed) ─────────────────────
test_ds     = DRDataset(test_pairs, transform=get_val_transforms())
test_loader = DataLoader(
    test_ds,
    batch_size  = CFG["batch_size"],
    shuffle     = False,
    num_workers = CFG.get("num_workers", 0),
    pin_memory  = (DEVICE.type == "cuda"),
)

# ── 3. Load model ──────────────────────────────────────────────────────────
print(f"Loading model from: {best_path}")
model = build_model().to(DEVICE)
model.load_state_dict(torch.load(best_path, map_location=DEVICE))
model.eval()

# ── 4. Inference ───────────────────────────────────────────────────────────
print("Running evaluation on test set...")
all_preds, all_labels = [], []

with torch.no_grad():
    for imgs, labels in tqdm(test_loader, desc="Evaluating"):
        imgs  = imgs.float().to(DEVICE)
        preds = model(imgs).argmax(1).cpu().tolist()
        all_preds.extend(preds)
        all_labels.extend(labels.tolist())

# ── 5. Report ──────────────────────────────────────────────────────────────
report = classification_report(
    all_labels, all_preds,
    target_names = CLASS_NAMES,
    digits       = 4,
)

print("\n" + "=" * 60)
print("  CLASSIFICATION REPORT (Test Set)")
print("=" * 60)
print(report)

report_path = os.path.join(CFG["checkpoint_dir"], "classification_report.txt")
with open(report_path, "w") as f:
    f.write(report)
print(f"\nReport saved → {report_path}")