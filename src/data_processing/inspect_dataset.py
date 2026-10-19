
import pandas as pd
from pathlib import Path

file_path = Path("data/raw/yellow_tripdata_2026-01.parquet")

if not file_path.exists():
    print(f"Dataset not found: {file_path.resolve()}")
else:
    df = pd.read_parquet(file_path)

    print("\n--- DATASET OVERVIEW ---")
    print("Rows:", len(df))
    print("Columns:", len(df.columns))

    print("\n--- COLUMN NAMES ---")
    print(df.columns.tolist())

    print("\n--- FIRST FIVE ROWS ---")
    print(df.head())

    print("\n--- DATA TYPES ---")
    print(df.dtypes)

    print("\n--- MISSING VALUES ---")
    print(df.isnull().sum())
