
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt

# Project paths
ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = (
    ROOT / "data" / "processed"
    / "yellow_tripdata_2026-01_clean.parquet"
)
OUTPUT_DIR = ROOT / "outputs"
REPORT_DIR = OUTPUT_DIR / "reports"
CHART_DIR = OUTPUT_DIR / "charts"

REPORT_DIR.mkdir(parents=True, exist_ok=True)
CHART_DIR.mkdir(parents=True, exist_ok=True)


def main():
    print("=" * 55)
    print("TAXI DEMAND ANALYSIS")
    print("=" * 55)

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Cleaned dataset not found: {DATA_FILE}\n"
            "Run clean_data.py first."
        )

    # Load only the columns needed for this analysis
    columns = [
        "PULocationID",
        "pickup_hour",
        "pickup_day_of_week",
    ]

    df = pd.read_parquet(DATA_FILE, columns=columns)

    print(f"\nRecords analyzed: {len(df):,}")

    # -----------------------------------------------
    # 1. Demand by pickup zone
    # -----------------------------------------------
    zone_demand = (
        df.groupby("PULocationID")
        .size()
        .reset_index(name="pickup_count")
        .sort_values("pickup_count", ascending=False)
    )

    zone_demand.to_csv(
        REPORT_DIR / "zone_demand.csv", index=False
    )

    top_zones = zone_demand.head(15)

    print("\n--- TOP 15 PICKUP ZONES ---")
    print(top_zones.to_string(index=False))

    plt.figure(figsize=(12, 6))
    plt.bar(
        top_zones["PULocationID"].astype(str),
        top_zones["pickup_count"],
    )
    plt.title("Top 15 Taxi Pickup Zones - January 2026")
    plt.xlabel("Pickup Zone ID")
    plt.ylabel("Number of Recorded Pickups")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(
        CHART_DIR / "top_15_pickup_zones.png",
        dpi=150,
    )
    plt.close()

    # -----------------------------------------------
    # 2. Demand by hour of day
    # -----------------------------------------------
    hourly_demand = (
        df.groupby("pickup_hour")
        .size()
        .reindex(range(24), fill_value=0)
        .rename("pickup_count")
        .reset_index()
    )

    hourly_demand.to_csv(
        REPORT_DIR / "hourly_demand.csv", index=False
    )

    peak_hour = hourly_demand.loc[
        hourly_demand["pickup_count"].idxmax()
    ]

    print("\n--- HOURLY DEMAND ---")
    print(hourly_demand.to_string(index=False))
    print(
        f"\nBusiest hour: {int(peak_hour['pickup_hour']):02d}:00 "
        f"with {int(peak_hour['pickup_count']):,} pickups"
    )

    plt.figure(figsize=(12, 6))
    plt.plot(
        hourly_demand["pickup_hour"],
        hourly_demand["pickup_count"],
        marker="o",
    )
    plt.title("Taxi Pickup Demand by Hour")
    plt.xlabel("Hour of Day (24-hour format)")
    plt.ylabel("Number of Recorded Pickups")
    plt.xticks(range(24))
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(
        CHART_DIR / "hourly_demand.png", dpi=150
    )
    plt.close()

    # -----------------------------------------------
    # 3. Demand by day of week
    # Monday = 0, Sunday = 6
    # -----------------------------------------------
    weekday_names = [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday"
    ]

    weekday_demand = (
        df.groupby("pickup_day_of_week")
        .size()
        .reindex(range(7), fill_value=0)
        .rename("pickup_count")
        .reset_index()
    )

    weekday_demand["day_name"] = (
        weekday_demand["pickup_day_of_week"]
        .map(dict(enumerate(weekday_names)))
    )

    weekday_demand.to_csv(
        REPORT_DIR / "weekday_demand.csv", index=False
    )

    print("\n--- DEMAND BY DAY OF WEEK ---")
    print(
        weekday_demand[
            ["day_name", "pickup_count"]
        ].to_string(index=False)
    )

    plt.figure(figsize=(10, 5))
    plt.bar(
        weekday_demand["day_name"],
        weekday_demand["pickup_count"],
    )
    plt.title("Taxi Pickup Demand by Day of Week")
    plt.xlabel("Day")
    plt.ylabel("Number of Recorded Pickups")
    plt.xticks(rotation=30)
    plt.tight_layout()
    plt.savefig(
        CHART_DIR / "weekday_demand.png", dpi=150
    )
    plt.close()

    # -----------------------------------------------
    # 4. Zone-by-hour demand matrix
    # This becomes useful for the RL environment.
    # -----------------------------------------------
    zone_hour = pd.crosstab(
        df["PULocationID"],
        df["pickup_hour"],
    ).reindex(columns=range(24), fill_value=0)

    zone_hour.to_csv(
        REPORT_DIR / "zone_hour_demand.csv"
    )

    print("\n--- ANALYSIS COMPLETE ---")
    print(f"Reports saved in: {REPORT_DIR}")
    print(f"Charts saved in:  {CHART_DIR}")
    print(
        "\nThese results estimate historical pickup demand. "
        "They do not directly measure idle taxis or passenger "
        "requests that never resulted in a trip."
    )


if __name__ == "__main__":
    main()
