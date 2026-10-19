
import pandas as pd
from pathlib import Path

source = Path("data/raw/yellow_tripdata_2026-01.parquet")
output = Path("data/processed/taxi_dataset_preview.xlsx")

if not source.exists():
    raise FileNotFoundError(f"Dataset not found: {source.resolve()}")

df = pd.read_parquet(source, engine="pyarrow")

print("Dataset shape:", df.shape)
print("\nColumns:", df.columns.tolist())

# Export a small sample for spreadsheet viewing
preview = df.head(1000)
output.parent.mkdir(parents=True, exist_ok=True)
preview.to_excel(output, index=False)

print(f"\nPreview saved to: {output.resolve()}")
print("Open this Excel file to view the data in columns.")
