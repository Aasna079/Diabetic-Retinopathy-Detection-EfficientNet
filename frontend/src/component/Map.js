import React, { useEffect, useRef, useState } from "react";
import "./Map.css";

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const hospitalMarkersRef = useRef([]);
  const userCircleRef = useRef(null);
  const userMarkerRef = useRef(null);

  const [location, setLocation] = useState("Detecting...");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [userCoords, setUserCoords] = useState(null);

  useEffect(() => {
    const now = new Date();
    setDate(now.toISOString().split("T")[0]);
    setTime(now.toTimeString().slice(0, 5));

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

      // Remove old circle and marker
      if (userCircleRef.current) mapInstance.current.removeLayer(userCircleRef.current);
      if (userMarkerRef.current) mapInstance.current.removeLayer(userMarkerRef.current);

      // User location circle with GPS accuracy
      userCircleRef.current = L.circle([lat, lng], {
        radius: accuracy,
        color: "#6c63ff",
        fillColor: "#6c63ff",
        fillOpacity: 0.15,
      }).addTo(mapInstance.current);

      // User marker
      userMarkerRef.current = L.marker([lat, lng])
        .addTo(mapInstance.current)
        .bindPopup("<b>Your Location</b>")
        .openPopup();
    };

    const addHospitalMarkers = (hospitals) => {
      const L = window.L;
      if (!L || !mapInstance.current) return;

      hospitalMarkersRef.current.forEach((markerObj) => {
        mapInstance.current.removeLayer(markerObj.marker);
      });
      hospitalMarkersRef.current = [];

      hospitals.forEach((hospital) => {
        if (hospital.lat && hospital.lng) {
          const marker = L.marker([hospital.lat, hospital.lng])
            .addTo(mapInstance.current)
            .bindPopup(
              `<b>${hospital.name}</b><br/>${hospital.area}<br/>${hospital.distance.toFixed(
                2
              )} km away`
            );
          hospitalMarkersRef.current.push({ id: hospital.id, marker });
        }
      });
    };

    const getLocationName = async (lat, lng) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await response.json();
       console.log("FULL ADDRESS:", data.address);

        const addr = data.address || {};

        let area =
          addr.neighbourhood ||
          addr.hamlet ||
          addr.suburb ||
          addr.city_district ||
          addr.city ||
          addr.town ||
          addr.village;

        
        if (area === "Chabahil" && addr.neighbourhood) {
          area = addr.neighbourhood;
        }

        // fallback
        if (!area && data.display_name) {
          area = data.display_name.split(",")[0];
        }

        setLocation(area || "Unknown Location");
      } catch (err) {
        console.error(err);
        setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    };


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

    const fetchNearbyHospitals = async (lat, lng) => {
      try {
        const radius = 5000;
        const query = `
          [out:json];
          (
            node["amenity"="hospital"](around:${radius},${lat},${lng});
            way["amenity"="hospital"](around:${radius},${lat},${lng});
            relation["amenity"="hospital"](around:${radius},${lat},${lng});
          );
          out center;
        `;
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query,
        });
        const data = await response.json();
        const hospitals = data.elements
          .map((item) => {
            const hospitalLat = item.lat || item.center?.lat;
            const hospitalLng = item.lon || item.center?.lon;
            if (!hospitalLat || !hospitalLng) return null;
            const distance = getDistance(lat, lng, hospitalLat, hospitalLng);
            return {
              id: item.id,
              name: item.tags?.name || "Unnamed Hospital",
              area: item.tags?.["addr:suburb"] || item.tags?.["addr:city"] || "Nearby Area",
              lat: hospitalLat,
              lng: hospitalLng,
              distance,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 6);
        setNearbyHospitals(hospitals);
        if (hospitals.length > 0) setSelectedHospitalId(hospitals[0].id);
        addHospitalMarkers(hospitals);
      } catch (err) {
        console.error(err);
        setNearbyHospitals([]);
      }
    };

    const initializeMap = () => {
      if (!navigator.geolocation) {
        // Fallback
        const fallbackLat = 27.7172;
        const fallbackLng = 85.324;
        setUserCoords({ lat: fallbackLat, lng: fallbackLng });
        setLocation("Kathmandu");
        loadMap(fallbackLat, fallbackLng);
        fetchNearbyHospitals(fallbackLat, fallbackLng);
        return;
      }

      // Watch position for real-time updates
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;

          setUserCoords({ lat, lng });
          loadMap(lat, lng, accuracy);
          await getLocationName(lat, lng);
          await fetchNearbyHospitals(lat, lng);
        },
        async (err) => {
          console.error("Geolocation error:", err);
          const fallbackLat = 27.7172;
          const fallbackLng = 85.324;
          setUserCoords({ lat: fallbackLat, lng: fallbackLng });
          setLocation("Kathmandu");
          loadMap(fallbackLat, fallbackLng);
          await fetchNearbyHospitals(fallbackLat, fallbackLng);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

      // Clean up watch on unmount
      return () => navigator.geolocation.clearWatch(watchId);
    };

    if (window.L) {
      initializeMap();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet/dist/leaflet.js";
    script.onload = () => initializeMap();
    document.body.appendChild(script);

    return () => {
      if (mapInstance.current) mapInstance.current.remove();
    };
  }, []);

  const handleHospitalClick = (hospital) => {
    setSelectedHospitalId(hospital.id);
    if (mapInstance.current) mapInstance.current.setView([hospital.lat, hospital.lng], 16);
    const selectedMarker = hospitalMarkersRef.current.find((m) => m.id === hospital.id);
    if (selectedMarker) selectedMarker.marker.openPopup();
  };

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
          <h3>Nearby Hospitals</h3>
          {nearbyHospitals.length > 0 ? (
            nearbyHospitals.map((hospital) => (
              <div
                key={hospital.id}
                className={`card ${selectedHospitalId === hospital.id ? "active" : ""}`}
                onClick={() => handleHospitalClick(hospital)}
                style={{ cursor: "pointer" }}
              >
                <h4>{hospital.name}</h4>
                <p>{hospital.area}</p>
                <p>{hospital.distance.toFixed(2)} km away</p>
              </div>
            ))
          ) : (
            <p>Loading nearby hospitals...</p>
          )}
        </div>
        <div className="map-container" ref={mapRef}></div>
      </div>
    </div>
  );
}