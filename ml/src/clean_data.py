import pandas as pd
import os

#load csv dataset again
raw_path = "data/raw/trainLabels_cropped.csv"
df = pd.read_csv(raw_path)

#remove unnamed columns
df = df.loc[:, ~df.columns.str.contains('^Unnamed')]

#drop duplicate rows
df = df.drop_duplicates()

#recheck the cleaned data
print("cleaned data")
print(df.head())
print(df.info())
print(df.isnull().sum())

#save cleaned data
clean_dir = "data/clean"
os.makedirs(clean_dir, exist_ok=True)

clean_path = os.path.join(clean_dir, "trainLabels_cropped_clean.csv")
df.to_csv(clean_path, index=False)
print(f"Cleaned CSV saved to: {clean_path}")