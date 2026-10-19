
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  Tooltip
} from "react-leaflet";
import {
  CarFront,
  MapPin,
  Route,
  Zap,
  Activity,
  Clock3,
  Navigation,
  RefreshCw
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API = "http://127.0.0.1:8000";

const zones = [
  { id: 12, name: "Midtown", pos: [40.7549, -73.984], demand: 95 },
  { id: 34, name: "Lower Manhattan", pos: [40.7075, -74.0113], demand: 82 },
  { id: 17, name: "Upper East Side", pos: [40.7736, -73.9566], demand: 74 },
  { id: 28, name: "Upper West Side", pos: [40.787, -73.9754], demand: 67 },
  { id: 41, name: "Brooklyn", pos: [40.6782, -73.9442], demand: 61 },
  { id: 23, name: "Long Island City", pos: [40.744, -73.948], demand: 57 },
  { id: 8, name: "Chelsea", pos: [40.7465, -74.0014], demand: 52 },
  { id: 19, name: "Greenwich Village", pos: [40.7336, -73.999], demand: 48 }
];

const taxis = [
  [40.761, -73.97],
  [40.731, -73.985],
  [40.747, -73.962],
  [40.72, -74.005],
  [40.775, -73.99],
  [40.689, -73.98],
  [40.755, -73.95],
  [40.71, -73.965],
  [40.782, -73.948]
];

function makeDemoPath(start, end, optimized) {
  const midLat = (start[0] + end[0]) / 2;
  const midLng = (start[1] + end[1]) / 2;
  const bend = optimized ? 0.002 : 0.006;

  return [
    start,
    [midLat + bend, midLng - bend],
    [midLat - bend, midLng + bend],
    end
  ];
}

function App() {
  const [pickup, setPickup] = useState("12");
  const [destination, setDestination] = useState("34");
  const [routeFound, setRouteFound] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showTaxis, setShowTaxis] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [apiStatus, setApiStatus] = useState("Connecting");
  const [totalTrips, setTotalTrips] = useState(null);
  const [zoneCounts, setZoneCounts] = useState({});

  useEffect(() => {
    fetch(`${API}/api/dashboard`)
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then((data) => {
        setTotalTrips(data.total_trips ?? null);

        const counts = {};
        (data.top_zones || []).forEach((item) => {
          const id = Number(item.PULocationID ?? item.zone);
          counts[id] = Number(item.pickup_count ?? item.count ?? 0);
        });
        setZoneCounts(counts);
        setApiStatus("Connected");
      })
      .catch(() => setApiStatus("Demo mode"));
  }, []);

  const startZone = zones.find((z) => String(z.id) === pickup) || zones[0];
  const endZone = zones.find((z) => String(z.id) === destination) || zones[1];

  const getDemand = (zone) => zoneCounts[zone.id] ?? zone.demand;
  const maxDemand = Math.max(...zones.map(getDemand), 1);

  const path = makeDemoPath(
    startZone.pos,
    endZone.pos,
    optimized
  );

  function findRoute() {
    if (pickup === destination) {
      window.alert("Please choose two different zones.");
      return;
    }
    setRouteFound(true);
    setOptimized(false);
  }

  function runOptimization() {
    if (pickup === destination) {
      window.alert("Choose different pickup and destination zones first.");
      return;
    }
    setRouteFound(true);
    setOptimized(true);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><CarFront size={27} /></div>
          <div>
            <h1>Taxi<span>Flow</span></h1>
            <p>INTELLIGENT ROUTE & FLEET OPTIMIZATION</p>
          </div>
        </div>

        <div className="header-right">
          <span className={`status-dot ${apiStatus === "Connected" ? "online" : ""}`} />
          <span>{apiStatus}</span>
          <span className="date-label">NYC · JAN 2026 DATA</span>
        </div>
      </header>

      <main className="layout">
        <aside className="left-panel">
          <div className="section-heading">
            <span className="section-number">01</span>
            <div>
              <h2>Plan your route</h2>
              <p>Choose your pickup and destination</p>
            </div>
          </div>

          <label className="field-label" htmlFor="pickup">
            <span className="field-dot pickup-dot" /> Pickup zone
          </label>
          <select id="pickup" value={pickup} onChange={(e) => setPickup(e.target.value)}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} · Zone {z.id}
              </option>
            ))}
          </select>

          <div className="route-connector" />

          <label className="field-label" htmlFor="destination">
            <span className="field-dot destination-dot" /> Destination zone
          </label>
          <select
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} · Zone {z.id}
              </option>
            ))}
          </select>

          <button className="btn btn-primary" onClick={findRoute}>
            <Route size={16} /> Find best route
          </button>

          {routeFound && (
            <div className="route-result">
              <span className="eyebrow">ROUTE SELECTED</span>
              <strong>{startZone.name} → {endZone.name}</strong>
              <div className="route-metrics">
                <div><Navigation size={15} /><span>{optimized ? "Demo optimized" : "Baseline route"}</span></div>
                <div><Clock3 size={15} /><span>{optimized ? "12 min*" : "18 min*"}</span></div>
              </div>
              <p>*Illustrative estimates, not real road directions.</p>
            </div>
          )}

          <div className="panel-divider" />

          <div className="section-heading">
            <span className="section-number">02</span>
            <div>
              <h2>Fleet optimization</h2>
              <p>Improve coverage using demand</p>
            </div>
          </div>

          <div className="goal-box">
            <Zap size={17} />
            <div>
              <strong>Optimization objective</strong>
              <span>Increase demand coverage</span>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={runOptimization}>
            <Activity size={16} /> Run optimization
          </button>

          {optimized && (
            <div className="success-note">
              <span>✓</span>
              Demo optimization applied. The displayed route is illustrative.
            </div>
          )}

          <div className="panel-divider" />

          <div className="section-heading compact-heading">
            <span className="section-number">03</span>
            <div><h2>Map layers</h2><p>Customize your view</p></div>
          </div>

          <label className="layer-row">
            <input
              type="checkbox"
              checked={showHotspots}
              onChange={(e) => setShowHotspots(e.target.checked)}
            />
            <span className="layer-icon hotspot-icon">●</span>
            Demand hotspots
          </label>
          <label className="layer-row">
            <input
              type="checkbox"
              checked={showTaxis}
              onChange={(e) => setShowTaxis(e.target.checked)}
            />
            <span className="layer-icon taxi-icon">◆</span>
            Demo taxi markers
          </label>
          <label className="layer-row">
            <input
              type="checkbox"
              checked={showRoute}
              onChange={(e) => setShowRoute(e.target.checked)}
            />
            <span className="layer-icon route-icon">━</span>
            Route line
          </label>
        </aside>

        <section className="map-panel">
          <div className="map-top-label">
            <div>
              <span className="eyebrow">LIVE MAP VIEW</span>
              <h2>New York City</h2>
            </div>
            <span className="map-tag"><span /> INTERACTIVE MAP</span>
          </div>

          <MapContainer
            center={[40.735, -73.976]}
            zoom={12}
            scrollWheelZoom
            className="map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {showHotspots && zones.map((zone) => (
              <CircleMarker
                key={`heat-${zone.id}`}
                center={zone.pos}
                radius={12 + 16 * getDemand(zone) / maxDemand}
                pathOptions={{
                  color: getDemand(zone) / maxDemand > 0.75 ? "#ff704f" : "#f4bc43",
                  fillColor: getDemand(zone) / maxDemand > 0.75 ? "#ff704f" : "#f4bc43",
                  fillOpacity: 0.2,
                  weight: 1
                }}
              >
                <Popup>{zone.name}<br />Demand indicator: {getDemand(zone)}</Popup>
              </CircleMarker>
            ))}

            {zones.map((zone) => (
              <CircleMarker
                key={`zone-${zone.id}`}
                center={zone.pos}
                radius={5}
                pathOptions={{
                  color: "#9285ff",
                  fillColor: "#9285ff",
                  fillOpacity: 1
                }}
              >
                <Tooltip>{zone.name} · Zone {zone.id}</Tooltip>
              </CircleMarker>
            ))}

            {showTaxis && taxis.map((pos, i) => (
              <CircleMarker
                key={`taxi-${i}`}
                center={pos}
                radius={4}
                pathOptions={{
                  color: "#ffd044",
                  fillColor: "#ffd044",
                  fillOpacity: 1,
                  weight: 1
                }}
              >
                <Tooltip>Illustrative taxi {i + 1}</Tooltip>
              </CircleMarker>
            ))}

            {showRoute && routeFound && (
              <>
                <Polyline
                  positions={path}
                  pathOptions={{
                    color: "#f6f7fb",
                    weight: 8,
                    opacity: 0.8,
                    dashArray: "5 8"
                  }}
                />
                <Polyline
                  positions={path}
                  pathOptions={{
                    color: optimized ? "#27d6a2" : "#438dff",
                    weight: 5,
                    opacity: 1
                  }}
                />
                <CircleMarker
                  center={startZone.pos}
                  radius={8}
                  pathOptions={{ color: "#fff", fillColor: "#ffca3a", fillOpacity: 1 }}
                >
                  <Popup>Pickup: {startZone.name}</Popup>
                </CircleMarker>
                <CircleMarker
                  center={endZone.pos}
                  radius={8}
                  pathOptions={{ color: "#fff", fillColor: "#27d6a2", fillOpacity: 1 }}
                >
                  <Popup>Destination: {endZone.name}</Popup>
                </CircleMarker>
              </>
            )}

            {optimized && zones.filter((z) => z.id === 17 || z.id === 28 || z.id === 41).map((z) => (
              <CircleMarker
                key={`relocate-${z.id}`}
                center={z.pos}
                radius={11}
                pathOptions={{
                  color: "#27d6a2",
                  fillColor: "#27d6a2",
                  fillOpacity: 0.55
                }}
              >
                <Popup>Suggested demand coverage zone: {z.name}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          <div className="map-legend">
            <span><i className="legend-hotspot" /> Demand hotspot</span>
            <span><i className="legend-zone" /> Pickup zone</span>
            <span><i className="legend-taxi" /> Taxi marker</span>
            <span><i className="legend-route" /> Route</span>
          </div>

          <div className="map-footer">
            <span><MapPin size={13} /> New York, United States</span>
            <span>Map data © OpenStreetMap</span>
          </div>
        </section>

        <aside className="right-panel">
          <section className="panel-card">
            <div className="card-heading">
              <div><span className="eyebrow">HISTORICAL DATA</span><h2>Demand overview</h2></div>
              <Activity size={19} />
            </div>

            <div className="trip-total">
              <span>Total recorded trips</span>
              <strong>{totalTrips == null ? "—" : totalTrips.toLocaleString()}</strong>
              <small>{totalTrips == null ? "Waiting for backend data" : "Trips in the connected report"}</small>
            </div>

            <div className="demand-list">
              {zones.slice(0, 6).map((zone) => (
                <div className="demand-row" key={zone.id}>
                  <span>{zone.name}</span>
                  <div className="demand-track">
                    <div style={{ width: `${100 * getDemand(zone) / maxDemand}%` }} />
                  </div>
                  <strong>{getDemand(zone).toLocaleString()}</strong>
                </div>
              ))}
            </div>
            <p className="disclaimer">
              Until real zone values are connected, the map uses illustrative demand indicators.
            </p>
          </section>

          <section className="panel-card">
            <div className="card-heading">
              <div><span className="eyebrow">FLEET STRATEGY</span><h2>Relocation suggestions</h2></div>
              <Zap size={19} />
            </div>

            {[
              ["17", "Upper East Side", "Demand coverage"],
              ["28", "Upper West Side", "Coverage opportunity"],
              ["41", "Brooklyn", "Demand balancing"]
            ].map(([id, name, reason], i) => (
              <div className="relocation-row" key={id}>
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <div><strong>{name}</strong><small>Zone {id} · {reason}</small></div>
                <span className="suggestion">Review</span>
              </div>
            ))}

            <button className="btn btn-outline" onClick={runOptimization}>
              <Navigation size={15} /> Preview relocation
            </button>
            <p className="disclaimer">
              Suggestions are demonstration values, not trained-agent predictions.
            </p>
          </section>

          <section className="panel-card">
            <div className="card-heading">
              <div><span className="eyebrow">ROUTE ANALYSIS</span><h2>Route comparison</h2></div>
              <Route size={19} />
            </div>

            <div className="comparison">
              <div className="comparison-item">
                <span>Baseline</span>
                <strong>{routeFound ? "2.8 km*" : "—"}</strong>
                <small><Clock3 size={13} /> {routeFound ? "18 min*" : "Find a route first"}</small>
              </div>
              <div className="comparison-item optimized-item">
                <span>Optimized demo</span>
                <strong>{routeFound && optimized ? "1.8 km*" : "—"}</strong>
                <small><Zap size={13} /> {routeFound && optimized ? "12 min*" : "Run optimization"}</small>
              </div>
            </div>
            <p className="disclaimer">
              *Placeholder estimates only. Real distances require a road-routing engine.
            </p>
          </section>
        </aside>

        <footer className="footer">
          <span><CarFront size={14} /> TaxiFlow · Route & Fleet Intelligence</span>
          <span><RefreshCw size={13} /> Data: January 2026 · NYC Yellow Taxi</span>
          <span>RL agent: not trained yet</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
