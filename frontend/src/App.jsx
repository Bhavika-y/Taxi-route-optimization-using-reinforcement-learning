import { useEffect, useId, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Polyline,
  Popup,
  GeoJSON,
  useMap,
} from "react-leaflet";
import { CarFront, CircleAlert } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API = "http://127.0.0.1:8000";
const NYC = [40.735, -73.976];

const PICKUP_COLOR = "#a99dff";
const DESTINATION_COLOR = "#f472b6";

function getDemandColor(p) {
  if (p >= 0.85) return "#EF4444";
  if (p >= 0.5) return "#EAB308";
  return "#22C55E";
}

function getDemandLabel(p) {
  if (p >= 0.85) return "High demand";
  if (p >= 0.5) return "Medium demand";
  return "Low demand";
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function pinIcon(name, p) {
  return L.divIcon({
    className: "zone-pin-wrap",
    html: `<div class="zone-pin">
      <span class="zone-pin-dot" style="background:${getDemandColor(p)}"></span>
      <span class="zone-pin-text"><strong>${escapeHtml(name)}</strong><small>${getDemandLabel(p)}</small></span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function firstCoordinate(coords) {
  let c = coords;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return c;
}

function featureCenter(feature) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const walk = (c) => {
    if (typeof c[0] === "number") {
      minX = Math.min(minX, c[0]);
      maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]);
      maxY = Math.max(maxY, c[1]);
    } else {
      c.forEach(walk);
    }
  };

  walk(feature.geometry?.coordinates || []);
  if (!Number.isFinite(minX)) return null;

  return [(minY + maxY) / 2, (minX + maxX) / 2];
}

function friendlyError(err, fallback) {
  if (err instanceof TypeError) {
    return "Cannot reach the backend. Check that FastAPI is running.";
  }
  return err?.message || fallback;
}

function MapController({ point, bounds }) {
  const map = useMap();

  useEffect(() => {
    if (point) {
      map.flyTo([point.lat, point.lon], 14, { duration: 0.8 });
    }
  }, [point, map]);

  useEffect(() => {
    if (bounds && bounds.length > 1) {
      map.flyToBounds(bounds, {
        paddingTopLeft: [60, 90],
        paddingBottomRight: [60, 70],
        duration: 0.9,
      });
    }
  }, [bounds, map]);

  return null;
}

function HeatLayer({ points, visible }) {
  const map = useMap();

  useEffect(() => {
    if (!visible || points.length === 0) return;

    let layer;
    let cancelled = false;

    window.L = L;

    import("leaflet.heat").then(() => {
      if (cancelled) return;

      layer = L.heatLayer(points, {
        radius: 36,
        blur: 26,
        maxZoom: 13,
        minOpacity: 0.45,
        gradient: {
          0.25: "#22C55E",
          0.5: "#EAB308",
          0.8: "#EF4444",
          1.0: "#B91C1C",
        },
      }).addTo(map);
    });

    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points, visible]);

  return null;
}

function LocationSearch({ label, color, value, onSelect }) {
  const inputId = useId();
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (query.trim().length < 3) {
      setError("Enter at least 3 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const response = await fetch(
        `${API}/api/geocode?q=${encodeURIComponent(query.trim())}`
      );

      if (!response.ok) {
        throw new Error("Address search is unavailable.");
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : [];

      setResults(list);

      if (list.length === 0) {
        setError("No matching NYC locations found.");
      }
    } catch (err) {
      setError(friendlyError(err, "Could not search locations."));
    } finally {
      setLoading(false);
    }
  }

  function pick(item) {
    onSelect(item);
    setQuery(item.name);
    setResults([]);
    setError("");
  }

  return (
    <div className="route-field">
      <label className="route-label" htmlFor={inputId}>
        <span
          className="location-dot"
          style={{ background: color }}
        />
        {label}
      </label>

      <div className="location-search-row">
        <input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") search();
          }}
          placeholder="Search an NYC address..."
        />

        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="secondary-button"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <p className="route-error">{error}</p>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((item, index) => (
            <button
              key={`${item.lat}-${item.lon}-${index}`}
              type="button"
              onClick={() => pick(item)}
              className="search-result"
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {value && (
        <p className="selected-location">
          Selected: {value.name}
        </p>
      )}
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [allZoneDemand, setAllZoneDemand] = useState([]);
  const [zoneGeoJSON, setZoneGeoJSON] = useState(null);
  const [zoneGeoError, setZoneGeoError] = useState("");
  const [apiError, setApiError] = useState("");

  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);

  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [focusPoint, setFocusPoint] = useState(null);

  const [optimizing, setOptimizing] = useState(false);
  const [relocation, setRelocation] = useState(null);
  const [optimizationMessage, setOptimizationMessage] = useState("");

  const [mapView, setMapView] = useState("heat");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [dashboardResponse, zonesResponse] = await Promise.all([
          fetch(`${API}/api/dashboard`),
          fetch(`${API}/api/zones`),
        ]);

        if (!dashboardResponse.ok) {
          throw new Error("Dashboard data could not be loaded.");
        }

        const dashboardData = await dashboardResponse.json();
        setDashboard(dashboardData);

        if (zonesResponse.ok) {
          const zonesData = await zonesResponse.json();

          setAllZoneDemand(
            Array.isArray(zonesData.zones) ? zonesData.zones : []
          );
          setApiError("");
        } else {
          setAllZoneDemand(dashboardData.top_zones || []);
          setApiError(
            "The backend /api/zones endpoint is missing. Update backend/main.py to enable all-zone demand."
          );
        }
      } catch {
        setApiError(
          "Cannot connect to the backend. Check that FastAPI is running."
        );
      }
    }

    async function loadZoneBoundaries() {
      try {
        const response = await fetch("/taxi_zones.geojson");
        const text = await response.text();

        if (!response.ok || text.trimStart().startsWith("<")) {
          throw new Error(
            "taxi_zones.geojson was not found in frontend/public."
          );
        }

        const geojson = JSON.parse(text);

        if (geojson.type !== "FeatureCollection") {
          throw new Error(
            "The zone file is not a GeoJSON FeatureCollection."
          );
        }

        const first = firstCoordinate(
          geojson.features?.[0]?.geometry?.coordinates
        );

        if (
          Array.isArray(first) &&
          (Math.abs(first[0]) > 180 || Math.abs(first[1]) > 90)
        ) {
          throw new Error(
            "The GeoJSON coordinates are not in longitude/latitude format."
          );
        }

        setZoneGeoJSON(geojson);
        setZoneGeoError("");
      } catch (err) {
        setZoneGeoError(
          err instanceof SyntaxError
            ? "taxi_zones.geojson is not valid JSON."
            : err.message
        );
      }
    }

    loadDashboard();
    loadZoneBoundaries();
  }, []);

  const demandByZone = useMemo(() => {
    const mapping = {};
    const source = allZoneDemand.length
      ? allZoneDemand
      : dashboard?.top_zones || [];

    for (const zone of source) {
      const id =
        zone.PULocationID ??
        zone.LocationID ??
        zone.location_id ??
        zone.locationid ??
        zone.zone_id ??
        zone.zone;

      const count = Number(
        zone.pickup_count ??
          zone.trip_count ??
          zone.total_trips ??
          zone.trips ??
          zone.count ??
          0
      );

      if (
        id !== undefined &&
        id !== null &&
        Number.isFinite(Number(id))
      ) {
        const key = String(Number(id));
        mapping[key] = (mapping[key] || 0) + count;
      }
    }

    return mapping;
  }, [allZoneDemand, dashboard]);

  const maxDemand = useMemo(() => {
    return Math.max(0, ...Object.values(demandByZone));
  }, [demandByZone]);

  const demandPercentile = useMemo(() => {
    const entries = Object.entries(demandByZone)
      .filter(([, count]) => count > 0)
      .sort((a, b) => a[1] - b[1]);

    const n = entries.length;
    const result = {};

    entries.forEach(([id], index) => {
      result[id] = n > 1 ? index / (n - 1) : 1;
    });

    return result;
  }, [demandByZone]);

  const zoneCenters = useMemo(() => {
    const list = [];

    for (const feature of zoneGeoJSON?.features || []) {
      const id =
        feature.properties?.LocationID ??
        feature.properties?.location_id ??
        feature.properties?.locationid ??
        feature.properties?.locationId;

      const center = featureCenter(feature);

      if (id == null || !center) continue;

      list.push({
        id: String(id),
        name:
          feature.properties?.zone ??
          feature.properties?.Zone ??
          `Zone ${id}`,
        center,
      });
    }

    return list;
  }, [zoneGeoJSON]);

  const zoneNames = useMemo(() => {
    const names = {};

    for (const zone of zoneCenters) {
      names[zone.id] = zone.name;
    }

    return names;
  }, [zoneCenters]);

  const zoneLabel = (id) =>
    zoneNames[String(id)] ?? `Zone ${id}`;

  const heatPoints = useMemo(() => {
    const points = [];

    for (const zone of zoneCenters) {
      const percentile = demandPercentile[zone.id];

      if (percentile === undefined) continue;

      points.push([
        zone.center[0],
        zone.center[1],
        0.12 + 0.88 * Math.pow(percentile, 1.6),
      ]);
    }

    return points;
  }, [zoneCenters, demandPercentile]);

  const pinZones = useMemo(() => {
    return zoneCenters
      .filter((zone) => demandByZone[zone.id] > 0)
      .sort(
        (a, b) => demandByZone[b.id] - demandByZone[a.id]
      )
      .slice(0, 5);
  }, [zoneCenters, demandByZone]);

  async function findRoute() {
    if (!pickup || !destination) {
      setRouteError("Select a pickup and destination first.");
      return;
    }

    setRouteLoading(true);
    setRouteError("");
    setRoutes([]);

    try {
      const params = new URLSearchParams({
        start_lat: String(pickup.lat),
        start_lon: String(pickup.lon),
        end_lat: String(destination.lat),
        end_lon: String(destination.lon),
      });

      const response = await fetch(
        `${API}/api/route?${params}`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not calculate the route."
        );
      }

      setRoutes(data.routes || []);
      setSelectedRoute(0);
    } catch (err) {
      setRouteError(
        friendlyError(err, "Road routing failed.")
      );
    } finally {
      setRouteLoading(false);
    }
  }

  async function runOptimization() {
    setOptimizing(true);
    setOptimizationMessage("");

    try {
      const response = await fetch(`${API}/api/relocation`);

      if (!response.ok) {
        throw new Error(
          "Could not load relocation suggestions."
        );
      }

      const data = await response.json();
      setRelocation(data);

      setOptimizationMessage(
        "Historical-demand baseline calculated. This is not a trained RL policy."
      );
    } catch (err) {
      setOptimizationMessage(
        friendlyError(err, "Optimization request failed.")
      );
    } finally {
      setOptimizing(false);
    }
  }

  const currentRoute = routes[selectedRoute];

  const routePositions = useMemo(
    () =>
      currentRoute?.coordinates?.map(([lon, lat]) => [
        lat,
        lon,
      ]) || [],
    [currentRoute]
  );

  const topZones = dashboard?.top_zones || [];

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <CarFront size={24} />
          </div>

          <div>
            <h1>
              Taxi<span>Flow</span>
            </h1>
            <p>Route and fleet optimization</p>
          </div>
        </div>

        <span className="data-badge">
          NYC · January 2026 data
        </span>
      </header>

      {apiError && (
        <div className="global-error" role="alert">
          <CircleAlert size={15} />
          {apiError}
        </div>
      )}

      <div className="dashboard-layout">
        <aside className="control-panel">
          <section className="panel-section">
            <h2>Plan your route</h2>
            <p className="section-description">
              Choose your pickup and destination
            </p>

            <LocationSearch
              label="Pickup location"
              color={PICKUP_COLOR}
              value={pickup}
              onSelect={(place) => {
                setPickup(place);
                setFocusPoint({ ...place });
                setRoutes([]);
              }}
            />

            <LocationSearch
              label="Destination"
              color={DESTINATION_COLOR}
              value={destination}
              onSelect={(place) => {
                setDestination(place);
                setFocusPoint({ ...place });
                setRoutes([]);
              }}
            />

            <button
              className="primary-button"
              onClick={findRoute}
              disabled={routeLoading}
            >
              {routeLoading
                ? "Finding route..."
                : "Find best route"}
            </button>

            {routeError && (
              <p className="route-error">{routeError}</p>
            )}

            {routes.length > 1 && (
              <div className="route-options">
                <label htmlFor="route-choice">
                  Route alternative
                </label>

                <select
                  id="route-choice"
                  value={selectedRoute}
                  onChange={(event) =>
                    setSelectedRoute(
                      Number(event.target.value)
                    )
                  }
                >
                  {routes.map((route, index) => (
                    <option key={index} value={index}>
                      Route {index + 1} · {route.distance_km} km ·{" "}
                      {route.duration_min} min
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentRoute && (
              <div className="route-summary">
                <div>
                  <strong>
                    {currentRoute.distance_km} km
                  </strong>
                  <span>Estimated distance</span>
                </div>

                <div>
                  <strong>
                    {currentRoute.duration_min} min
                  </strong>
                  <span>Estimated time</span>
                </div>
              </div>
            )}

            <p className="fine-print">
              Travel time is estimated; live traffic is not included.
            </p>
          </section>

          <section className="panel-section">
            <h2>Fleet optimization</h2>
            <p className="section-description">
              Compare fleet allocation with historical demand
            </p>

            <button
              className="primary-button optimize-button"
              onClick={runOptimization}
              disabled={optimizing}
            >
              {optimizing
                ? "Calculating..."
                : "Run optimization"}
            </button>

            {optimizationMessage && (
              <p className="fine-print">
                {optimizationMessage}
              </p>
            )}
          </section>
        </aside>

        <section className="map-section">
          <MapContainer
            center={NYC}
            zoom={11}
            className="taxi-map"
            scrollWheelZoom
          >
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, USGS, and contributors"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />

            <MapController
              point={focusPoint}
              bounds={routePositions}
            />

            <HeatLayer
              points={heatPoints}
              visible={mapView === "heat"}
            />

            {zoneGeoJSON && (
              <GeoJSON
                key={`${mapView}-${maxDemand}-${Object.keys(demandByZone).length}`}
                data={zoneGeoJSON}
                style={(feature) => {
                  const id = String(
                    feature.properties?.LocationID ??
                      feature.properties?.location_id ??
                      feature.properties?.locationid ??
                      feature.properties?.locationId
                  );

                  const percentile = demandPercentile[id];

                  if (mapView === "heat") {
                    return {
                      fillOpacity: 0,
                      color: "#64748b",
                      weight: 0.7,
                      opacity: 0.35,
                    };
                  }

                  return {
                    fillColor:
                      percentile === undefined
                        ? "#94a3b8"
                        : getDemandColor(percentile),
                    fillOpacity:
                      percentile === undefined ? 0.1 : 0.55,
                    color: "#ffffff",
                    weight: 1.2,
                    opacity: 0.9,
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const id =
                    feature.properties?.LocationID ??
                    feature.properties?.location_id ??
                    feature.properties?.locationid ??
                    feature.properties?.locationId;

                  const name =
                    feature.properties?.zone ??
                    feature.properties?.Zone ??
                    `Zone ${id}`;

                  const count =
                    demandByZone[String(id)] ?? 0;

                  const safeName = escapeHtml(name);

                  layer.bindTooltip(
                    `${safeName} · ${count.toLocaleString()} pickups`
                  );

                  layer.bindPopup(
                    `<strong>${safeName}</strong><br/>Historical pickups: ${count.toLocaleString()}`
                  );
                }}
              />
            )}

            {mapView === "heat" &&
              pinZones.map((zone) => (
                <Marker
                  key={`pin-${zone.id}`}
                  position={zone.center}
                  icon={pinIcon(
                    zone.name,
                    demandPercentile[zone.id]
                  )}
                  interactive={false}
                />
              ))}

            {routePositions.length > 0 && (
              <>
                <Polyline
                  positions={routePositions}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 10,
                    opacity: 1,
                    lineCap: "round",
                  }}
                />

                <Polyline
                  positions={routePositions}
                  pathOptions={{
                    color: "#4285F4",
                    weight: 6,
                    opacity: 1,
                    lineCap: "round",
                  }}
                />
              </>
            )}

            {pickup && (
              <CircleMarker
                center={[pickup.lat, pickup.lon]}
                radius={8}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: PICKUP_COLOR,
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>Pickup: {pickup.name}</Popup>
              </CircleMarker>
            )}

            {destination && (
              <CircleMarker
                center={[
                  destination.lat,
                  destination.lon,
                ]}
                radius={8}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: DESTINATION_COLOR,
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  Destination: {destination.name}
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>

          <div
            className="view-toggle"
            role="group"
            aria-label="Map view"
          >
            <button
              type="button"
              className={mapView === "heat" ? "on" : ""}
              aria-pressed={mapView === "heat"}
              onClick={() => setMapView("heat")}
            >
              Heatmap
            </button>

            <button
              type="button"
              className={mapView === "zones" ? "on" : ""}
              aria-pressed={mapView === "zones"}
              onClick={() => setMapView("zones")}
            >
              Zones
            </button>
          </div>

          <div className="demand-legend">
            <strong>Pickup demand</strong>

            {mapView === "heat" ? (
              <>
                <span>Low</span>
                <i className="legend-gradient" />
                <span>High</span>
              </>
            ) : (
              <>
                <span>
                  <i style={{ background: "#EF4444" }} />
                  High
                </span>

                <span>
                  <i style={{ background: "#EAB308" }} />
                  Medium
                </span>

                <span>
                  <i style={{ background: "#22C55E" }} />
                  Low
                </span>

                <span>
                  <i style={{ background: "#94a3b8" }} />
                  No data
                </span>
              </>
            )}
          </div>

          {zoneGeoError && (
            <p className="map-notice">{zoneGeoError}</p>
          )}
        </section>

        <aside className="insights-panel">
          <section className="insight-card">
            <h2>Demand overview</h2>

            <div className="metric-card">
              <strong>
                {dashboard
                  ? Number(
                      dashboard.total_trips
                    ).toLocaleString()
                  : "—"}
              </strong>
              <span>Total recorded trips</span>
            </div>

            <div className="metric-row">
              <span>Pickup zones</span>
              <strong>
                {dashboard?.pickup_zones ??
                  dashboard?.distinct_zones ??
                  allZoneDemand.length ??
                  "—"}
              </strong>
            </div>

            <div className="metric-row">
              <span>Peak pickup hour</span>
              <strong>{dashboard?.peak_hour ?? "—"}</strong>
            </div>

            <h3>Highest-demand zones</h3>

            {topZones.slice(0, 7).map((zone, index) => {
              const count = Number(zone.pickup_count || 0);
              const ratio =
                maxDemand > 0 ? count / maxDemand : 0;

              const id =
                zone.PULocationID ??
                zone.LocationID ??
                zone.zone;

              const percentile =
                demandPercentile[String(id)] ?? 0;

              return (
                <div
                  className="demand-row"
                  key={`${id}-${index}`}
                >
                  <span title={zoneLabel(id)}>
                    {zoneLabel(id)}
                  </span>

                  <div className="demand-bar">
                    <div
                      style={{
                        width: `${ratio * 100}%`,
                        background: getDemandColor(
                          percentile
                        ),
                      }}
                    />
                  </div>

                  <strong>{count.toLocaleString()}</strong>
                </div>
              );
            })}

            {!dashboard && (
              <p className="fine-print">
                Waiting for backend data.
              </p>
            )}
          </section>

          <section className="insight-card">
            <h2>Relocation suggestions</h2>

            {(relocation?.suggestions ||
              relocation?.zones ||
              []).length ? (
              (
                relocation.suggestions ||
                relocation.zones
              )
                .slice(0, 5)
                .map((zone, index) => {
                  const id =
                    zone.LocationID ??
                    zone.location_id ??
                    zone.zone;

                  const count =
                    zone.pickup_count ?? zone.count ?? 0;

                  return (
                    <div
                      className="relocation-row"
                      key={id ?? index}
                    >
                      <span className="rank">
                        {index + 1}
                      </span>

                      <div>
                        <strong>{zoneLabel(id)}</strong>
                        <p>
                          {zone.recommendation ||
                            `${Number(count).toLocaleString()} historical pickups`}
                        </p>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="section-description">
                Run optimization to calculate a historical-demand baseline.
              </p>
            )}
          </section>

          <p className="fine-print">
            Historical January 2026 data. Colors show demand
            relative to other zones. Relocation suggestions are
            a baseline, not output from a trained
            reinforcement-learning agent.
          </p>
        </aside>
      </div>
    </main>
  );
}