import React, { useEffect, useRef, useState } from "react";
import "./Map.css";

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const hospitalMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  const routeControlRef = useRef(null); 

  const [location, setLocation] = useState("Detecting...");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [userCoords, setUserCoords] = useState(null);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);

  // ---------------- DATE & TIME ----------------
  useEffect(() => {
    const now = new Date();
    setDate(now.toISOString().split("T")[0]);
    setTime(now.toTimeString().slice(0, 5));
  }, []);

  // ---------------- LOAD MAP ----------------
  const loadMap = (lat, lng, accuracy = 3000) => {
    const L = window.L;
    if (!L) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([lat, lng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapInstance.current);
    } else {
      mapInstance.current.setView([lat, lng], 14);
    }

    if (userMarkerRef.current)
      mapInstance.current.removeLayer(userMarkerRef.current);
    if (userCircleRef.current)
      mapInstance.current.removeLayer(userCircleRef.current);

    userMarkerRef.current = L.marker([lat, lng])
      .addTo(mapInstance.current)
      .bindPopup("<b>Your Location</b>")
      .openPopup();

    userCircleRef.current = L.circle([lat, lng], {
      radius: accuracy,
      color: "#6c63ff",
      fillOpacity: 0.15,
    }).addTo(mapInstance.current);
  };

  // ---------------- ROUTE FUNCTION ----------------
  const showRoute = (hospital) => {
    const L = window.L;
    if (!L || !mapInstance.current || !userCoords) return;

    // remove old route
    if (routeControlRef.current) {
      mapInstance.current.removeControl(routeControlRef.current);
    }

    routeControlRef.current = L.Routing.control({
      waypoints: [
        L.latLng(userCoords.lat, userCoords.lng),
        L.latLng(hospital.lat, hospital.lng),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      createMarker: () => null,
      lineOptions: {
        styles: [{ color: "#2e7d32", weight: 5 }],
      },
    }).addTo(mapInstance.current);
  };

  // ---------------- DISTANCE ----------------
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ---------------- FETCH HOSPITALS ----------------
  const fetchNearbyHospitals = async (lat, lng) => {
    try {
      const radius = 8000;

      const query = `
      [out:json];
      (
        node["amenity"~"hospital|clinic"](around:${radius},${lat},${lng});
        way["amenity"~"hospital|clinic"](around:${radius},${lat},${lng});
        relation["amenity"~"hospital|clinic"](around:${radius},${lat},${lng});
      );
      out center;
      `;

      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      const data = await res.json();

      const hospitals = data.elements
        .map((item) => {
          const latH = item.lat || item.center?.lat;
          const lngH = item.lon || item.center?.lon;
          if (!latH || !lngH) return null;

          const name = item.tags?.name || "";

          const isEye =
            name.toLowerCase().includes("eye") ||
            name.toLowerCase().includes("vision") ||
            name.toLowerCase().includes("ophthalmology") ||
            name.toLowerCase().includes("optical");

          return {
            id: item.id,
            name: name || "Medical Center",
            area:
              item.tags?.["addr:suburb"] ||
              item.tags?.["addr:city"] ||
              "Nearby Area",
            lat: latH,
            lng: lngH,
            distance: getDistance(lat, lng, latH, lngH),
            isEye,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.isEye && !b.isEye) return -1;
          if (!a.isEye && b.isEye) return 1;
          return a.distance - b.distance;
        })
        .slice(0, 8);

      setNearbyHospitals(hospitals);

      if (hospitals.length) {
        setSelectedHospitalId(hospitals[0].id);
      }

      addMarkers(hospitals);
    } catch (err) {
      console.error(err);
      setNearbyHospitals([]);
    }
  };

  // ---------------- ADD MARKERS ----------------
  const addMarkers = (hospitals) => {
    const L = window.L;
    if (!L || !mapInstance.current) return;

    hospitalMarkersRef.current.forEach((m) =>
      mapInstance.current.removeLayer(m.marker)
    );
    hospitalMarkersRef.current = [];

    hospitals.forEach((h) => {
      const marker = L.marker([h.lat, h.lng])
        .addTo(mapInstance.current)
        .bindPopup(
          `<b>${h.name}</b><br/>${h.area}<br/>${h.distance.toFixed(2)} km away`
        );

      hospitalMarkersRef.current.push({ id: h.id, marker });
    });
  };

  // ---------------- LOCATION ----------------
  const getLocationName = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();

      const addr = data.address || {};
      const area =
        addr.neighbourhood ||
        addr.suburb ||
        addr.city ||
        data.display_name?.split(",")[0];

      setLocation(area || "Unknown");
    } catch {
      setLocation("Unknown");
    }
  };

  // ---------------- INIT ----------------
  useEffect(() => {
    const init = () => {
      navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;

          setUserCoords({ lat: latitude, lng: longitude });

          loadMap(latitude, longitude, accuracy);
          getLocationName(latitude, longitude);
          fetchNearbyHospitals(latitude, longitude);
        },
        () => {
          const lat = 27.7172;
          const lng = 85.324;
          loadMap(lat, lng);
          fetchNearbyHospitals(lat, lng);
        },
        { enableHighAccuracy: true }
      );
    };

    // Load Leaflet + Routing
    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet/dist/leaflet.css";
      document.head.appendChild(link);

      const routingCSS = document.createElement("link");
      routingCSS.rel = "stylesheet";
      routingCSS.href =
        "https://unpkg.com/leaflet-routing-machine/dist/leaflet-routing-machine.css";
      document.head.appendChild(routingCSS);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet/dist/leaflet.js";

      script.onload = () => {
        const routingScript = document.createElement("script");
        routingScript.src =
          "https://unpkg.com/leaflet-routing-machine/dist/leaflet-routing-machine.js";
        routingScript.onload = init;
        document.body.appendChild(routingScript);
      };

      document.body.appendChild(script);
    } else {
      init();
    }

    return () => {
      if (mapInstance.current) mapInstance.current.remove();
    };
  }, []);

  // ---------------- CLICK ----------------
  const handleHospitalClick = (h) => {
    setSelectedHospitalId(h.id);
    mapInstance.current.setView([h.lat, h.lng], 16);

    const marker = hospitalMarkersRef.current.find((m) => m.id === h.id);
    if (marker) marker.marker.openPopup();

    showRoute(h); // ✅ ROUTE TRIGGER
  };

  // ---------------- UI ----------------
  return (
    <div className="map-page">
      <div className="top-bar">
        <div className="filters">
          <div className="filter-group">
            <label>LOCATION</label>
            <input value={location} readOnly />
          </div>
          <div className="filter-group">
            <label>DATE</label>
            <input type="date" value={date} readOnly />
          </div>
          <div className="filter-group">
            <label>TIME</label>
            <input type="time" value={time} readOnly />
          </div>
        </div>
      </div>

      <div className="content">
        <div className="left-panel">
          <h3>Nearby Eye Hospital and Clinics</h3>

          {nearbyHospitals.map((hospital) => (
            <div
              key={hospital.id}
              className={`card ${
                selectedHospitalId === hospital.id ? "active" : ""
              }`}
              onClick={() => handleHospitalClick(hospital)}
            >
              <h4>{hospital.name}</h4>
              <p>{hospital.area}</p>
              <p>{hospital.distance.toFixed(2)} km away</p>

              <button
                className="nav-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  showRoute(hospital);
                }}
              >
                Show Route
              </button>
            </div>
          ))}
        </div>

        <div className="map-container" ref={mapRef}></div>
      </div>
    </div>
  );
}