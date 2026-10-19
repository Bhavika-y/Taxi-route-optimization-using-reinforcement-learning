
from pathlib import Path

import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


# --------------------------------------------------
# APP CONFIGURATION
# --------------------------------------------------

app = FastAPI(
    title="TaxiFlow API",
    description="NYC taxi demand analytics and road-route services",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Project root = Taxi Optimization/
BASE_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = BASE_DIR / "outputs" / "reports"


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def read_report(filename: str) -> pd.DataFrame:
    """Read a generated CSV report."""
    path = REPORTS_DIR / filename

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Report not found: {path}. Generate the demand reports first.",
        )

    try:
        return pd.read_csv(path)
    except (OSError, pd.errors.ParserError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read report: {filename}",
        ) from exc


def find_column(df: pd.DataFrame, candidates: list[str]) -> str:
    """Find a column using possible column names."""
    for candidate in candidates:
        if candidate in df.columns:
            return candidate

    raise HTTPException(
        status_code=500,
        detail=(
            f"Expected one of {candidates}; "
            f"available columns are {df.columns.tolist()}"
        ),
    )


def records_for_json(df: pd.DataFrame) -> list[dict]:
    """Convert a DataFrame into JSON-safe records."""
    return df.astype(object).where(pd.notna(df), None).to_dict(
        orient="records"
    )


# --------------------------------------------------
# ROOT AND HEALTH
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to TaxiFlow API",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}


# --------------------------------------------------
# DASHBOARD
# --------------------------------------------------

@app.get("/api/dashboard")
def dashboard():
    zones = read_report("zone_demand.csv")
    hourly = read_report("hourly_demand.csv")
    weekdays = read_report("weekday_demand.csv")

    zone_col = find_column(
        zones,
        ["PULocationID", "LocationID", "zone", "location_id"],
    )
    count_col = find_column(
        zones,
        ["pickup_count", "trip_count", "total_trips", "count"],
    )
    hour_col = find_column(
        hourly,
        ["pickup_hour", "hour", "Hour"],
    )
    hour_count_col = find_column(
        hourly,
        ["pickup_count", "trip_count", "total_trips", "count"],
    )
    day_col = find_column(
        weekdays,
        ["weekday", "day_name", "day_of_week", "weekday_name"],
    )
    day_count_col = find_column(
        weekdays,
        ["pickup_count", "trip_count", "total_trips", "count"],
    )

    zones[count_col] = pd.to_numeric(
        zones[count_col], errors="coerce"
    ).fillna(0)

    hourly[hour_count_col] = pd.to_numeric(
        hourly[hour_count_col], errors="coerce"
    ).fillna(0)

    weekdays[day_count_col] = pd.to_numeric(
        weekdays[day_count_col], errors="coerce"
    ).fillna(0)

    top_zones = zones.sort_values(
        count_col, ascending=False
    ).head(10).copy()

    peak_hour_row = hourly.loc[hourly[hour_count_col].idxmax()]
    busiest_zone_row = top_zones.iloc[0]

    return {
        "total_trips": int(zones[count_col].sum()),
        "distinct_zones": int(zones[zone_col].nunique()),
        "busiest_zone": str(busiest_zone_row[zone_col]),
        "peak_hour": int(peak_hour_row[hour_col]),
        "top_zones": [
            {
                "PULocationID": str(row[zone_col]),
                "pickup_count": int(row[count_col]),
            }
            for _, row in top_zones.iterrows()
        ],
        "hourly_demand": [
            {
                "hour": int(row[hour_col]),
                "pickup_count": int(row[hour_count_col]),
            }
            for _, row in hourly.iterrows()
        ],
        "weekday_demand": [
            {
                "weekday": str(row[day_col]),
                "pickup_count": int(row[day_count_col]),
            }
            for _, row in weekdays.iterrows()
        ],
    }


# --------------------------------------------------
# DEMAND BY ZONE AND HOUR
# --------------------------------------------------

@app.get("/api/zone-hour")
def zone_hour():
    df = read_report("zone_hour_demand.csv")
    return {"data": records_for_json(df)}


# --------------------------------------------------
# FLEET RELOCATION BASELINE
# --------------------------------------------------

@app.get("/api/relocation")
def relocation():
    """
    Compare historical demand shares with an illustrative
    fleet allocation. This is a simulated baseline, not a
    trained reinforcement-learning agent or live fleet feed.
    """
    df = read_report("zone_demand.csv")

    zone_col = find_column(
        df,
        ["PULocationID", "LocationID", "zone", "location_id"],
    )
    count_col = find_column(
        df,
        ["pickup_count", "trip_count", "total_trips", "count"],
    )

    df[count_col] = pd.to_numeric(
        df[count_col], errors="coerce"
    ).fillna(0)

    df = df[df[count_col] > 0].copy()

    if df.empty:
        return {"total_taxis": 100, "zones": []}

    total_demand = float(df[count_col].sum())
    total_taxis = 100

    df["demand_share"] = df[count_col] / total_demand
    df["suggested_taxis"] = (
        df["demand_share"] * total_taxis
    ).round().astype(int)

    # Correct rounding so the total allocation is exactly 100.
    difference = total_taxis - int(df["suggested_taxis"].sum())

    if difference != 0:
        largest_zone = df[count_col].idxmax()
        df.loc[largest_zone, "suggested_taxis"] += difference

    return {
        "total_taxis": total_taxis,
        "method": "Historical-demand proportional baseline",
        "zones": [
            {
                "zone": str(row[zone_col]),
                "pickup_count": int(row[count_col]),
                "demand_share_pct": round(
                    float(row["demand_share"]) * 100, 2
                ),
                "suggested_taxis": int(row["suggested_taxis"]),
            }
            for _, row in df.sort_values(
                count_col, ascending=False
            ).head(20).iterrows()
        ],
    }


# --------------------------------------------------
# ADDRESS SEARCH — NYC
# --------------------------------------------------

@app.get("/api/geocode")
def geocode(
    q: str = Query(..., min_length=3, max_length=200)
):
    """
    Search for an address or place in New York City.
    Uses OpenStreetMap Nominatim.
    """
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": q,
                "format": "jsonv2",
                "limit": 5,
                "countrycodes": "us",
                "viewbox": "-74.30,40.95,-73.65,40.45",
                "bounded": 1,
            },
            headers={
                "User-Agent": "TaxiFlowStudentProject/1.0"
            },
            timeout=15,
        )
        response.raise_for_status()
        results = response.json()

        return [
            {
                "name": item.get("display_name", "Unknown location"),
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
            }
            for item in results
        ]

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail="Address search is temporarily unavailable.",
        ) from exc


# --------------------------------------------------
# REAL ROAD ROUTING — OSRM
# --------------------------------------------------

@app.get("/api/route")
def road_route(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
):
    """
    Get road routes between two NYC-area coordinates.
    OSRM supplies road geometry, distance and estimated duration.
    """
    coordinates = [
        (start_lat, start_lon),
        (end_lat, end_lon),
    ]

    for lat, lon in coordinates:
        if not (
            40.40 <= lat <= 40.95
            and -74.30 <= lon <= -73.65
        ):
            raise HTTPException(
                status_code=400,
                detail="Choose pickup and destination locations in the NYC area.",
            )

    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}"
    )

    try:
        response = requests.get(
            url,
            params={
                "overview": "full",
                "geometries": "geojson",
                "alternatives": "true",
                "steps": "false",
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail="Road routing is temporarily unavailable.",
        ) from exc

    if data.get("code") != "Ok" or not data.get("routes"):
        raise HTTPException(
            status_code=404,
            detail="No drivable route was found for these locations.",
        )

    return {
        "routes": [
            {
                "distance_km": round(
                    route["distance"] / 1000, 2
                ),
                "duration_min": round(
                    route["duration"] / 60
                ),
                # GeoJSON order is [longitude, latitude].
                "coordinates": route["geometry"]["coordinates"],
            }
            for route in data["routes"]
        ]
    }
