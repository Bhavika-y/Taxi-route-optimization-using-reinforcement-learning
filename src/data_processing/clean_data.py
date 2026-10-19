
from pathlib import Path
import pandas as pd

# Project paths
ROOT = Path(__file__).resolve().parents[2]
RAW_FILE = ROOT / "data" / "raw" / "yellow_tripdata_2026-01.parquet"
OUTPUT_DIR = ROOT / "data" / "processed"
CLEAN_FILE = OUTPUT_DIR / "yellow_tripdata_2026-01_clean.parquet"
REPORT_FILE = OUTPUT_DIR / "cleaning_report.csv"

PICKUP_TIME = "tpep_pickup_datetime"
PICKUP_ZONE = "PULocationID"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not RAW_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {RAW_FILE}\n"
            "Check that the original file is inside data/raw/."
        )

    print("Loading original taxi dataset...")
    df = pd.read_parquet(RAW_FILE)

    initial_rows = len(df)
    report = []

    def record_step(name, before, after):
        report.append({
            "step": name,
            "rows_before": before,
            "rows_after": after,
            "rows_removed": before - after
        })
        print(f"{name}: {before - after:,} rows removed")

    print(f"Original rows: {initial_rows:,}")
    print(f"Original columns: {len(df.columns)}")

    # 1. Normalize column names
    df.columns = df.columns.str.strip()

    # 2. Verify essential columns
    required = [PICKUP_TIME, PICKUP_ZONE]
    missing = [col for col in required if col not in df.columns]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}\n"
            f"Available columns: {df.columns.tolist()}"
        )

    # 3. Remove exact duplicate records
    before = len(df)
    df = df.drop_duplicates().copy()
    record_step("Exact duplicates", before, len(df))

    # 4. Parse pickup timestamp
    before = len(df)
    df[PICKUP_TIME] = pd.to_datetime(
        df[PICKUP_TIME], errors="coerce"
    )
    df = df.dropna(subset=[PICKUP_TIME]).copy()
    record_step("Missing/invalid pickup timestamp", before, len(df))

    # 5. Validate pickup zone IDs
    before = len(df)
    zones = pd.to_numeric(df[PICKUP_ZONE], errors="coerce")

    valid_zone = (
        zones.notna()
        & zones.gt(0)
        & zones.mod(1).eq(0)
    )

    df = df.loc[valid_zone].copy()
    df[PICKUP_ZONE] = zones.loc[df.index].astype("int32")
    record_step("Missing/invalid pickup zone", before, len(df))

    # 6. Remove pickups outside the intended month
    before = len(df)
    in_january = (
        df[PICKUP_TIME].dt.year.eq(2026)
        & df[PICKUP_TIME].dt.month.eq(1)
    )
    df = df.loc[in_january].copy()
    record_step("Pickup outside January 2026", before, len(df))

    # 7. Add useful features for demand analysis
    df["pickup_date"] = df[PICKUP_TIME].dt.date.astype(str)
    df["pickup_hour"] = df[PICKUP_TIME].dt.hour
    df["pickup_day_of_week"] = df[PICKUP_TIME].dt.dayofweek
    df["pickup_time_block"] = df[PICKUP_TIME].dt.floor("1h")

    # 8. Save cleaned dataset and audit report
    df.to_parquet(CLEAN_FILE, index=False)
    pd.DataFrame(report).to_csv(REPORT_FILE, index=False)

    print("\n--- CLEANING COMPLETE ---")
    print(f"Rows before: {initial_rows:,}")
    print(f"Rows after:  {len(df):,}")
    print(f"Rows removed: {initial_rows - len(df):,}")
    print(f"Retention: {len(df) / initial_rows * 100:.2f}%"
          if initial_rows else "Retention: N/A")
    print(f"\nClean data: {CLEAN_FILE}")
    print(f"Cleaning report: {REPORT_FILE}")
    print("\nRemaining missing values in essential columns:")
    print(df[[PICKUP_TIME, PICKUP_ZONE]].isna().sum())


if __name__ == "__main__":
    main()
