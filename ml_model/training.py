"""
train.py
========
Complete EfficientNet-B4 training pipeline for Diabetic Retinopathy Detection.

Does everything in one script:
  1. Reads APTOS dataset (train.csv + train_images/)
  2. Cleans & validates images
  3. Applies CLAHE preprocessing (saved to disk for speed)
  4. Balances classes
  5. Creates 70/15/15 stratified train/val/test split
  6. Trains EfficientNet-B4 with class-weighted loss + augmentation
  7. Saves best_model.pth  ← used directly by inference.py and api.py

CLAHE params (clip_limit=2.0, tile=(8,8)) match inference.py exactly.
Model architecture (Dropout 0.4 + Linear) matches inference.py exactly.

Requirements:
  pip install torch torchvision opencv-python albumentations scikit-learn tqdm matplotlib pandas

Run:
  python train.py
"""

import os, cv2, json, shutil, random, hashlib, logging
import numpy as np
import pandas as pd
from pathlib import Path
from collections import Counter
from tqdm import tqdm
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import models
import albumentations as A
from albumentations.pytorch import ToTensorV2
from sklearn.model_selection import StratifiedShuffleSplit

# ═══════════════════════════════════════════════════════════════════════════════
#  CONFIG  ← edit these paths to match your machine
# ═══════════════════════════════════════════════════════════════════════════════

CFG = {
    # ── Input (your APTOS download) ──────────────────────────────────────────
    "csv_path":         r"D:\traingmodelds\aptos2019-blindness-detection\train.csv",
    "raw_img_dir":      r"D:\traingmodelds\aptos2019-blindness-detection\train_images",

    # ── Intermediate dirs (auto-created) ─────────────────────────────────────
    "clahe_dir":        r"D:\traingmodelds\data\clahe",       # CLAHE images
    "splits_json":      r"D:\traingmodelds\data\splits.json", # train/val/test split

    # ── Output ────────────────────────────────────────────────────────────────
    "checkpoint_dir":   r"D:\new\Dr_Project\checkpoints",
    "checkpoint_name":  "best_model.pth",

    # ── CLAHE (must match inference.py) ──────────────────────────────────────
    "clahe_clip":       2.0,
    "clahe_tile":       (8, 8),

    # ── Balancing ─────────────────────────────────────────────────────────────
    # Max images per class after balancing (minority classes get augmented up)
    "balance_target":   600,

    # ── Model ─────────────────────────────────────────────────────────────────
    "num_classes":      5,
    "image_size":       380,   # EfficientNet-B4 native size

    # ── Training ──────────────────────────────────────────────────────────────
    "epochs":           30,
    "batch_size":       16,    # reduce to 8 if GPU OOM
    "lr":               1e-4,
    "weight_decay":     1e-4,
    "num_workers":      0,     # 0 is safest on Windows
    "seed":             42,
    "save_every_n":     5,
}

CLASS_NAMES = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)
random.seed(CFG["seed"])
np.random.seed(CFG["seed"])
torch.manual_seed(CFG["seed"])


# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1 — CLAHE PREPROCESSING
#  Identical operation to inference.py apply_clahe()
# ═══════════════════════════════════════════════════════════════════════════════

def apply_clahe_bgr(img_bgr: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE to L channel of LAB color space.
    Input/output: BGR numpy array.
    This is the same operation as apply_clahe() in inference.py,
    just operating on BGR arrays instead of PIL images.
    """
    lab        = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b    = cv2.split(lab)
    clahe      = cv2.createCLAHE(clipLimit=CFG["clahe_clip"],
                                  tileGridSize=CFG["clahe_tile"])
    l_enhanced = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l_enhanced, a, b]), cv2.COLOR_LAB2BGR)


def is_valid_image(img_bgr: np.ndarray) -> bool:
    """Reject corrupt, too-dark, or non-retinal images."""
    if img_bgr is None or img_bgr.shape[0] < 100 or img_bgr.shape[1] < 100:
        return False
    gray     = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    # Must have >20% non-black pixels (rejects corrupted/blank images)
    _, thresh = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
    if np.sum(thresh > 0) / thresh.size < 0.2:
        return False
    # Must not be blurry
    if cv2.Laplacian(gray, cv2.CV_64F).var() < 10.0:
        return False
    return True


def crop_black_borders(img_bgr: np.ndarray, tol: int = 7) -> np.ndarray:
    gray     = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, tol, 255, cv2.THRESH_BINARY)
    coords   = cv2.findNonZero(thresh)
    if coords is None:
        return img_bgr
    x, y, w, h = cv2.boundingRect(coords)
    return img_bgr[y:y+h, x:x+w]


def preprocess_and_save(raw_img_dir: str, csv_path: str, clahe_dir: str) -> list:
    """
    Read CSV, apply CLAHE to every valid image, save to clahe_dir/<label>/<id>.jpg
    Returns list of (clahe_image_path, label) tuples.
    """
    clahe_dir = Path(clahe_dir)

    # Check if already done
    manifest = clahe_dir / "manifest.json"
    if manifest.exists():
        log.info(f"CLAHE dir exists, loading manifest: {manifest}")
        with open(manifest) as f:
            return [(p, l) for p, l in json.load(f)]

    log.info("Applying CLAHE to dataset (first run only — saved to disk)...")
    df      = pd.read_csv(csv_path)
    img_dir = Path(raw_img_dir)
    pairs   = []
    seen    = set()
    skipped = 0

    for _, row in tqdm(df.iterrows(), total=len(df), desc="  CLAHE"):
        label    = int(row["diagnosis"])
        img_id   = str(row["id_code"])
        img_path = img_dir / f"{img_id}.png"
        if not img_path.exists():
            img_path = img_dir / f"{img_id}.jpg"
        if not img_path.exists():
            skipped += 1
            continue

        # Duplicate check
        h = hashlib.md5(open(img_path, "rb").read()).hexdigest()
        if h in seen:
            skipped += 1
            continue
        seen.add(h)

        img = cv2.imread(str(img_path))
        if not is_valid_image(img):
            skipped += 1
            continue

        img = crop_black_borders(img)
        img = apply_clahe_bgr(img)
        img = cv2.resize(img, (CFG["image_size"], CFG["image_size"]),
                         interpolation=cv2.INTER_LANCZOS4)

        out_dir  = clahe_dir / str(label)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{img_id}.jpg"
        cv2.imwrite(str(out_path), img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        pairs.append((str(out_path), label))

    log.info(f"  Saved: {len(pairs)} | Skipped: {skipped}")

    # Print class distribution
    dist = Counter(l for _, l in pairs)
    log.info("  Class distribution after CLAHE:")
    for cls_id, name in enumerate(CLASS_NAMES):
        log.info(f"    {cls_id} {name:<25}: {dist.get(cls_id, 0)}")

    with open(manifest, "w") as f:
        json.dump(pairs, f)

    return pairs


# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 2 — BALANCE CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

def augment_for_balance(img_path: str, dst_dir: Path, n_needed: int) -> list:
    """Generate up to n_needed augmented copies of an image."""
    img  = cv2.imread(img_path)
    ops  = [
        lambda x: cv2.flip(x, 1),                                   # h-flip
        lambda x: cv2.flip(x, 0),                                   # v-flip
        lambda x: cv2.rotate(x, cv2.ROTATE_90_CLOCKWISE),
        lambda x: cv2.rotate(x, cv2.ROTATE_90_COUNTERCLOCKWISE),
        lambda x: cv2.rotate(x, cv2.ROTATE_180),
    ]
    new_paths = []
    stem      = Path(img_path).stem
    for i, op in enumerate(ops):
        if len(new_paths) >= n_needed:
            break
        aug_img  = op(img)
        aug_path = dst_dir / f"{stem}_aug{i}.jpg"
        cv2.imwrite(str(aug_path), aug_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        new_paths.append(str(aug_path))
    return new_paths


def balance_classes(pairs: list) -> list:
    """
    Undersample majority classes, augment minority classes,
    so every class has at most CFG['balance_target'] images.
    """
    log.info("\nBalancing classes...")
    from collections import defaultdict
    by_class = defaultdict(list)
    for p, l in pairs:
        by_class[l].append(p)

    target   = CFG["balance_target"]
    balanced = []

    for cls_id in range(CFG["num_classes"]):
        paths = by_class[cls_id]
        random.shuffle(paths)
        name  = CLASS_NAMES[cls_id]

        if len(paths) >= target:
            # Undersample
            selected = paths[:target]
            log.info(f"  {cls_id} {name:<25}: {len(paths)} → {len(selected)} (undersampled)")
        else:
            # Augment up to target
            selected = list(paths)
            needed   = target - len(selected)
            aug_dir  = Path(CFG["clahe_dir"]) / str(cls_id)
            aug_dir.mkdir(exist_ok=True)
            i = 0
            while len(selected) < target:
                src  = paths[i % len(paths)]
                want = min(5, target - len(selected))
                new  = augment_for_balance(src, aug_dir, want)
                selected.extend(new)
                i += 1
            selected = selected[:target]
            log.info(f"  {cls_id} {name:<25}: {len(paths)} → {len(selected)} (augmented)")

        balanced.extend([(p, cls_id) for p in selected])

    return balanced


# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 3 — STRATIFIED SPLIT  70 / 15 / 15
# ═══════════════════════════════════════════════════════════════════════════════

def make_splits(pairs: list) -> tuple:
    """Returns (train_pairs, val_pairs, test_pairs)."""
    splits_path = Path(CFG["splits_json"])

    if splits_path.exists():
        log.info(f"Loading existing splits: {splits_path}")
        with open(splits_path) as f:
            s = json.load(f)
        return ([(p, l) for p, l in s["train"]],
                [(p, l) for p, l in s["val"]],
                [(p, l) for p, l in s["test"]])

    log.info("\nCreating 70/15/15 stratified split...")
    paths  = np.array([p for p, _ in pairs])
    labels = np.array([l for _, l in pairs])

    sss1             = StratifiedShuffleSplit(1, test_size=0.30, random_state=CFG["seed"])
    train_idx, rest  = next(sss1.split(paths, labels))

    sss2            = StratifiedShuffleSplit(1, test_size=0.50, random_state=CFG["seed"])
    val_idx, tst_idx = next(sss2.split(paths[rest], labels[rest]))
    val_idx, tst_idx = rest[val_idx], rest[tst_idx]

    def fmt(idx): return [[paths[i], int(labels[i])] for i in idx]

    splits = {"train": fmt(train_idx), "val": fmt(val_idx), "test": fmt(tst_idx)}
    splits_path.parent.mkdir(parents=True, exist_ok=True)
    with open(splits_path, "w") as f:
        json.dump(splits, f)

    log.info(f"  Train: {len(train_idx)} | Val: {len(val_idx)} | Test: {len(tst_idx)}")
    return ([(p, l) for p, l in splits["train"]],
            [(p, l) for p, l in splits["val"]],
            [(p, l) for p, l in splits["test"]])


# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 4 — DATASET + DATALOADERS
#  NOTE: Images already have CLAHE applied on disk (Step 1).
#        Albumentations transforms here are augmentation ONLY.
# ═══════════════════════════════════════════════════════════════════════════════

def get_train_transforms():
    return A.Compose([
        A.Resize(CFG["image_size"], CFG["image_size"]),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.RandomRotate90(p=0.5),
        A.Rotate(limit=30, p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
        A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20,
                             val_shift_limit=10, p=0.3),
        A.GaussNoise(var_limit=(10.0, 50.0), p=0.2),
        A.CoarseDropout(max_holes=8, max_height=20, max_width=20, p=0.2),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])


def get_val_transforms():
    return A.Compose([
        A.Resize(CFG["image_size"], CFG["image_size"]),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])


class DRDataset(Dataset):
    def __init__(self, pairs: list, transform=None):
        self.pairs     = pairs
        self.transform = transform

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        img_path, label = self.pairs[idx]
        img = cv2.imread(img_path)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        if self.transform:
            img = self.transform(image=img)["image"]
        return img, label


def make_dataloaders(train_p, val_p, test_p):
    train_ds = DRDataset(train_p, get_train_transforms())
    val_ds   = DRDataset(val_p,   get_val_transforms())
    test_ds  = DRDataset(test_p,  get_val_transforms())

    # WeightedRandomSampler — oversample minority classes in each batch
    labels         = [l for _, l in train_p]
    count          = Counter(labels)
    total          = len(labels)
    class_w        = {c: total / count[c] for c in count}
    sample_weights = [class_w[l] for l in labels]
    sampler        = WeightedRandomSampler(sample_weights, len(sample_weights),
                                           replacement=True)

    kw = dict(num_workers=CFG["num_workers"], pin_memory=(DEVICE.type == "cuda"))
    train_loader = DataLoader(train_ds, batch_size=CFG["batch_size"],
                              sampler=sampler, **kw)
    val_loader   = DataLoader(val_ds,   batch_size=CFG["batch_size"],
                              shuffle=False, **kw)
    test_loader  = DataLoader(test_ds,  batch_size=CFG["batch_size"],
                              shuffle=False, **kw)
    return train_loader, val_loader, test_loader


# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 5 — MODEL
#  Architecture must match inference.py exactly:
#    efficientnet_b4 → classifier = [Dropout(0.4), Linear(in, 5)]
# ═══════════════════════════════════════════════════════════════════════════════

def build_model() -> nn.Module:
    model       = models.efficientnet_b4(weights=models.EfficientNet_B4_Weights.DEFAULT)
    in_features = model.classifier[1].in_features
    # ↓ Must match inference.py DRInference.__init__ classifier exactly
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4, inplace=True),
        nn.Linear(in_features, CFG["num_classes"]),
    )
    return model


# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 6 — TRAINING
# ═══════════════════════════════════════════════════════════════════════════════

def compute_class_weights(train_pairs: list) -> torch.Tensor:
    """
    Inverse-frequency class weights.
    Penalizes misclassifying rare classes (Severe, Proliferative) more.
    """
    labels = [l for _, l in train_pairs]
    count  = Counter(labels)
    total  = len(labels)
    n_cls  = CFG["num_classes"]
    weights = [total / (n_cls * count.get(i, 1)) for i in range(n_cls)]
    log.info(f"\n  Class weights: { {CLASS_NAMES[i]: round(w,3) for i,w in enumerate(weights)} }")
    return torch.tensor(weights, dtype=torch.float).to(DEVICE)


def train_epoch(model, loader, optimizer, criterion, scaler):
    model.train()
    loss_sum = correct = total = 0
    for imgs, labels in tqdm(loader, desc="  Train", leave=False):
        imgs, labels = imgs.float().to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        with torch.cuda.amp.autocast(enabled=(DEVICE.type == "cuda")):
            out  = model(imgs)
            loss = criterion(out, labels)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        loss_sum += loss.item() * imgs.size(0)
        correct  += (out.argmax(1) == labels).sum().item()
        total    += imgs.size(0)
    return loss_sum / total, correct / total


@torch.no_grad()
def eval_epoch(model, loader, criterion):
    model.eval()
    loss_sum = correct = total = 0
    for imgs, labels in tqdm(loader, desc="  Eval ", leave=False):
        imgs, labels = imgs.float().to(DEVICE), labels.to(DEVICE)
        with torch.cuda.amp.autocast(enabled=(DEVICE.type == "cuda")):
            out  = model(imgs)
            loss = criterion(out, labels)
        loss_sum += loss.item() * imgs.size(0)
        correct  += (out.argmax(1) == labels).sum().item()
        total    += imgs.size(0)
    return loss_sum / total, correct / total


def save_plot(history, path):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    ep = range(1, len(history["tl"]) + 1)
    ax1.plot(ep, history["tl"], label="Train"); ax1.plot(ep, history["vl"], label="Val")
    ax1.set_title("Loss");     ax1.legend(); ax1.grid(True)
    ax2.plot(ep, history["ta"], label="Train"); ax2.plot(ep, history["va"], label="Val")
    ax2.set_title("Accuracy"); ax2.legend(); ax2.grid(True)
    plt.tight_layout(); plt.savefig(path, dpi=150); plt.close()
    log.info(f"  📊 Plot → {path}")


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "="*65)
    print("  EfficientNet-B4  |  DR Detection  |  Full Training Pipeline")
    print(f"  Device : {DEVICE}")
    print("="*65)

    # ── 1. CLAHE preprocessing ─────────────────────────────────────────────────
    print("\n[1/6] CLAHE preprocessing...")
    pairs = preprocess_and_save(CFG["raw_img_dir"], CFG["csv_path"], CFG["clahe_dir"])

    # ── 2. Balance classes ─────────────────────────────────────────────────────
    print("\n[2/6] Balancing classes...")
    pairs = balance_classes(pairs)
    dist  = Counter(l for _, l in pairs)
    print(f"  After balancing: { {CLASS_NAMES[i]: dist[i] for i in range(5)} }")

    # ── 3. Split ────────────────────────────────────────────────────────────────
    print("\n[3/6] Creating splits...")
    train_pairs, val_pairs, test_pairs = make_splits(pairs)
    print(f"  Train: {len(train_pairs)} | Val: {len(val_pairs)} | Test: {len(test_pairs)}")

    # ── 4. DataLoaders ─────────────────────────────────────────────────────────
    print("\n[4/6] Building DataLoaders...")
    train_loader, val_loader, test_loader = make_dataloaders(
        train_pairs, val_pairs, test_pairs)
    print(f"  Train batches: {len(train_loader)} | Val: {len(val_loader)}")

    # ── 5. Model + training setup ──────────────────────────────────────────────
    print("\n[5/6] Building model...")
    model     = build_model().to(DEVICE)
    print(f"  Params: {sum(p.numel() for p in model.parameters()):,}")

    criterion = nn.CrossEntropyLoss(weight=compute_class_weights(train_pairs))
    optimizer = torch.optim.AdamW(model.parameters(),
                                  lr=CFG["lr"], weight_decay=CFG["weight_decay"])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
                    optimizer, T_max=CFG["epochs"], eta_min=1e-6)
    scaler    = torch.cuda.amp.GradScaler(enabled=(DEVICE.type == "cuda"))

    os.makedirs(CFG["checkpoint_dir"], exist_ok=True)
    best_path    = os.path.join(CFG["checkpoint_dir"], CFG["checkpoint_name"])
    best_val_acc = 0.0
    history      = {"tl": [], "vl": [], "ta": [], "va": []}

    # ── 6. Training loop ────────────────────────────────────────────────────────
    print(f"\n[6/6] Training for {CFG['epochs']} epochs...\n")

    for epoch in range(1, CFG["epochs"] + 1):
        lr = scheduler.get_last_lr()[0]
        print(f"Epoch {epoch:02d}/{CFG['epochs']}  lr={lr:.2e}")

        tl, ta = train_epoch(model, train_loader, optimizer, criterion, scaler)
        vl, va = eval_epoch (model, val_loader,   criterion)
        scheduler.step()

        history["tl"].append(tl); history["ta"].append(ta)
        history["vl"].append(vl); history["va"].append(va)

        print(f"  Train  loss={tl:.4f}  acc={ta:.4f}")
        print(f"  Val    loss={vl:.4f}  acc={va:.4f}")

        if va > best_val_acc:
            best_val_acc = va
            torch.save(model.state_dict(), best_path)
            print(f"  ✅ Best saved → {best_path}  (val_acc={va:.4f})")

        if epoch % CFG["save_every_n"] == 0:
            ep_path = os.path.join(CFG["checkpoint_dir"], f"epoch_{epoch:02d}.pth")
            torch.save(model.state_dict(), ep_path)
            print(f"  💾 Checkpoint → {ep_path}")

        print()

    # ── Final test evaluation ───────────────────────────────────────────────────
    model.load_state_dict(torch.load(best_path, map_location=DEVICE))
    _, test_acc = eval_epoch(model, test_loader, criterion)

    plot_path = os.path.join(CFG["checkpoint_dir"], "training_curves.png")
    save_plot(history, plot_path)

    print("="*65)
    print(f"  Training complete!")
    print(f"  Best val accuracy  : {best_val_acc:.4f}")
    print(f"  Test accuracy      : {test_acc:.4f}")
    print(f"  Model saved to     : {best_path}")
    print(f"  Plot saved to      : {plot_path}")
    print("="*65)
    print("\n  ✅ Your api.py and inference.py will use this model automatically.")


if __name__ == "__main__":
    main()
