import os

split_dir = "data/split"

print("Verifying number of images in each split folder:\n")

for split in ["train", "val", "test"]:
    folder = os.path.join(split_dir, split)

    if os.path.exists(folder):
        num_files = len([f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f))])
        print(f"{split} folder: {num_files} images")
    else:
        print(f"{split} folder does not exist!")

print("\n Verification complete.")
