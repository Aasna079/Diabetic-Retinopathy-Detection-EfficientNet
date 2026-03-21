import pandas as pd
import shutil
import os
from sklearn.model_selection import train_test_split

#paths
csv_path = "data/clean/trainLabels_cropped_clean.csv"
image_dir = "data/raw/images"
output_dir = "data/split"

#load csv
df = pd.read_csv(csv_path)

#extension addition
df["image"] = df["image"] + ".jpeg"

#splitting csv
train_df, temp_df = train_test_split(df, test_size=0.2, random_state=42)
val_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=42)

#copying images to the folders
def copy_images(df, split_name):
    split_folder = os.path.join(output_dir, split_name)
    for _, row in df.iterrows():
        src = os.path.join(image_dir, row["image"])
        dst = os.path.join(split_folder, row["image"])
        if os.path.exists(src):
            shutil.copy(src, dst)
        else:
            print("Missing:", src)

print("Copying TRAIN images...")
copy_images(train_df, "train")

print("Copying VAL images...")
copy_images(val_df, "val")

print("Copying TEST images...")
copy_images(test_df, "test")

print("DONE! Images have been split into train/val/test.")