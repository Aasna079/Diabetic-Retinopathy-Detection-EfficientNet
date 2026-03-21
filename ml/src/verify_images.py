import os
import pandas as pd
from PIL import Image

# paths
csv_path = "data/clean/trainLabels_cropped_clean.csv"
images_folder = "data/raw/images"

#load cleaned csv
df = pd.read_csv(csv_path)

#set image extension since it is there in the images but not readable by the csv file.
img_ext = ".jpeg"

#tracking missing and corrupted images
missing_images = []
corrupted_images = []

for img_name in df['image']:
    img_file = img_name + img_ext
    img_path = os.path.join(images_folder, img_file)

    #check if image exists
    if not os.path.exists(img_path):
        missing_images.append(img_file)
    else:
        #check if image can be opened
        try:
            with Image.open(img_path) as img:
                img.verify()  #verify without opening full image
        except:
            corrupted_images.append(img_file)

#results
print(f"Total images in CSV: {len(df)}")
print(f"Missing images: {len(missing_images)}")
print(f"Corrupted images: {len(corrupted_images)}")

if missing_images:
    print("List of missing images:", missing_images[:10], "...")  # show first 10
if corrupted_images:
    print("List of corrupted images:", corrupted_images[:10], "...")