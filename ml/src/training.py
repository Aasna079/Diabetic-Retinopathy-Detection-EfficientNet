import torch
from torch import nn, optim
from torchvision.models import resnet34, ResNet34_Weights
import os
from collections import Counter
from torch.utils.data import WeightedRandomSampler, DataLoader

# Import your get_loaders function
from data_loading import get_loaders, DEVICE, NUM_CLASSES

# ====== Hyperparameters ======
BATCH_SIZE = 32
EPOCHS = 15
LEARNING_RATE = 3e-4
CHECKPOINT_PATH = "F:/Minor_Project/DR_Project/resnet34.pth"

if __name__ == "__main__":
    # ====== Load Data ======
    train_loader, val_loader, test_loader, train_dataset, _, _ = get_loaders(
        batch_size=BATCH_SIZE, num_workers=4
    )

    # ====== Weighted Sampler for Imbalanced Dataset ======
    labels = train_dataset.data.iloc[:, 1].values
    counts = Counter(labels)
    weights_per_class = {i: 1.0 / counts[i] for i in range(NUM_CLASSES)}
    sample_weights = [weights_per_class[label] for label in labels]

    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True
    )

    # Replace train_loader with sampler-based DataLoader
    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        sampler=sampler,
        num_workers=4
    )

    # ====== Load Model ======
    model = resnet34(weights=ResNet34_Weights.IMAGENET1K_V1)

    # Unfreeze layers for fine-tuning
    for name, param in model.named_parameters():
        if any(x in name for x in ["layer1", "layer2", "layer3", "layer4", "fc"]):
            param.requires_grad = True
        else:
            param.requires_grad = False

    # Replace final fc with Dropout + Linear
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(model.fc.in_features, NUM_CLASSES)
    )

    # Move model to device
    model = model.to(DEVICE)

    # ====== Load Checkpoint if exists ======
    if os.path.exists(CHECKPOINT_PATH):
        print("Loading checkpoint...")
        model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=DEVICE))
        print("Checkpoint loaded.")

    # ====== Sanity Check ======
    images, labels = next(iter(train_loader))
    images, labels = images.to(DEVICE), labels.to(DEVICE)
    model.eval()
    with torch.no_grad():
        outputs = model(images)
        preds = torch.argmax(outputs, dim=1)
    print("Sanity check on one batch:")
    print("True labels:", labels.cpu().tolist())
    print("Predicted:", preds.cpu().tolist())

    # ====== Loss and Optimizer ======
    criterion = nn.CrossEntropyLoss()  # sampler handles class imbalance
    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=LEARNING_RATE)

    # ====== Training Loop ======
    for epoch in range(EPOCHS):
        model.train()
        running_loss, correct, total = 0.0, 0, 0

        for images, labels in train_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            preds = torch.argmax(outputs, dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        train_loss = running_loss / total
        train_acc = correct / total

        # ====== Validation ======
        model.eval()
        val_correct, val_total = 0, 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(DEVICE), labels.to(DEVICE)
                outputs = model(images)
                preds = torch.argmax(outputs, dim=1)
                val_correct += (preds == labels).sum().item()
                val_total += labels.size(0)
        val_acc = val_correct / val_total

        print(f"Epoch [{epoch+1}/{EPOCHS}]  Train Loss: {train_loss:.4f}  "
              f"Train Acc: {train_acc:.4f}  Val Acc: {val_acc:.4f}")

    # ====== Save Checkpoint ======
    torch.save(model.state_dict(), CHECKPOINT_PATH)
    print(f"Checkpoint saved at epoch {epoch+1}")

    # ====== Test Evaluation ======
    model.eval()
    test_correct, test_total = 0, 0
    with torch.no_grad():
        for images, labels in test_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            outputs = model(images)
            preds = torch.argmax(outputs, dim=1)
            test_correct += (preds == labels).sum().item()
            test_total += labels.size(0)
    test_acc = test_correct / test_total
    print(f"Test Accuracy: {test_acc:.4f}")
