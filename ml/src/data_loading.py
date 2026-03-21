import os
import pandas as pd
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

#parameters
BATCH_SIZE = 32
IMAGE_SIZE = 224
NUM_WORKERS = 4

#path
csv_path = "data/clean/trainLabels_cropped_clean.csv"
split_dir = "data/split"

# ===== TRAIN TRANSFORM (with augmentation) =====
train_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ===== VAL / TEST TRANSFORM (NO augmentation) =====
val_test_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# Define the custom dataset class
class DRDataset(Dataset):
    def __init__(self, csv_path, img_dir, transform=None):
        self.data = pd.read_csv(csv_path)
        self.img_dir = img_dir
        self.transform = transform

        # Filter CSV for only images present in this folder
        all_images = set(os.listdir(img_dir))
        self.data = self.data[self.data['image'].apply(lambda x: (x+".jpeg") in all_images)].reset_index(drop=True)


    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        img_name = self.data.iloc[idx, 0] + ".jpeg"   # adjust extension if needed
        label = self.data.iloc[idx, 1]               # label column name
        img_path = os.path.join(self.img_dir, img_name)

        image = Image.open(img_path).convert("RGB")
        if self.transform:
            image = self.transform(image)

        return image, label
    

# ======= DEVICE =======
import torch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ======= NUMBER OF CLASSES =======
NUM_CLASSES = 5   # change if your dataset has different number of labels

def get_loaders(batch_size=BATCH_SIZE, num_workers=0):
    #creating datasets and dataloaders
    train_dataset = DRDataset(csv_path, img_dir=os.path.join(split_dir, "train"), transform=train_transform)
    val_dataset   = DRDataset(csv_path, img_dir=os.path.join(split_dir, "val"), transform=val_test_transform)
    test_dataset  = DRDataset(csv_path, img_dir=os.path.join(split_dir, "test"), transform=val_test_transform)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=NUM_WORKERS)
    val_loader   = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
    test_loader  = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
    return train_loader, val_loader, test_loader, train_dataset, val_dataset, test_dataset


if __name__ == "__main__":
    # ===========================
    # Optional: quick verification
    # ===========================
    train_loader, val_loader, test_loader, train_dataset, val_dataset, test_dataset = get_loaders()
    print(f"Train: {len(train_dataset)} images")
    print(f"Val:   {len(val_dataset)} images")
    print(f"Test:  {len(test_dataset)} images")

    # Example: iterate through one batch
    images, labels = next(iter(train_loader))
    print("Batch shapes:", images.shape, labels.shape)

    from collections import Counter
    print("Class distribution (TRAIN):")
    print(Counter(train_dataset.data.iloc[:, 1]))

