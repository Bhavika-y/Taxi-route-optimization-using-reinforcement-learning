import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export default function ZoneSelect({
  id,
  label,
  tone,
  value,
  onChange,
  zones,
  getDemand,
  maxDemand
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const selected = zones.find((z) => String(z.id) === String(value));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (z) => z.name.toLowerCase().includes(q) || String(z.id).includes(q)
    );
  }, [query, zones]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    setQuery("");
    setActive(Math.max(0, zones.findIndex((z) => String(z.id) === String(value))));
    setOpen((o) => !o);
  }

  function choose(zone) {
    onChange(String(zone.id));
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="zone-select" ref={rootRef}>
      <label className="field-label" id={`${id}-label`} htmlFor={id}>
        <span className={`field-dot ${tone}`} /> {label}
      </label>

      <button
        id={id}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={toggle}
      >
        <span className="select-value">
          <strong>{selected?.name}</strong>
          <small>Zone {selected?.id}</small>
        </span>
        <ChevronDown size={16} className={open ? "chev open" : "chev"} />
      </button>

      {open && (
        <div className="select-menu">
          <div className="select-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search zone name or number"
              aria-label="Search zones"
            />
          </div>

          <ul role="listbox" aria-labelledby={`${id}-label`}>
            {results.length === 0 && (
              <li className="select-empty">No zone matches “{query}”.</li>
            )}
            {results.map((zone, i) => {
              const isSelected = String(zone.id) === String(value);
              return (
                <li
                  key={zone.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`select-option ${i === active ? "active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(zone)}
                >
                  <span className="option-main">
                    <strong>{zone.name}</strong>
                    <small>Zone {zone.id}</small>
                  </span>
                  <span className="option-demand" title="Demand indicator">
                    <span
                      style={{ width: `${(100 * getDemand(zone)) / maxDemand}%` }}
                    />
                  </span>
                  {isSelected && <Check size={14} className="option-check" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}