import pandas as pd

#load csv dataset
file_path = "data/raw/trainLabels_cropped.csv"
df = pd.read_csv(file_path)

#check first row
print(df.head())

#check info and missing values
print(df.info())
print(df.isnull().sum())
# Check for duplicate rows
print(df.duplicated().sum())

