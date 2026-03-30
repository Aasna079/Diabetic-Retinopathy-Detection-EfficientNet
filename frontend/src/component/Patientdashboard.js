import React, { useState, useEffect } from "react";
import "./PatientDashboard.css";
import PatientProfile from "./PatientProfile";
import Chatbot from "./Chatbot";
import Map from "./Map";

export default function PatientDashboard() {
  const [patient, setPatient] = useState(null);
  const [reports, setReports] = useState([]);
  const [activePage, setActivePage] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Fetch patient from backend
  useEffect(() => {
    console.log("PatientDashboard mounted");

    const initPatient = async () => {
      let storedUser = localStorage.getItem("user");

      if (storedUser) {
        storedUser = JSON.parse(storedUser);
        console.log("Using patient from localStorage:", storedUser);
        setPatient(storedUser);
      } else {
        console.warn("No user in localStorage. Fetching default patient from backend...");
        try {
          // Replace doctor_id with actual value if needed
          const res = await fetch("http://localhost:5000/api/patients?doctor_id=demo_doctor");
          const data = await res.json();

          if (data.length > 0) {
            console.log("Fetched default patient:", data[0]);
            setPatient(data[0]);
            localStorage.setItem("user", JSON.stringify(data[0]));
          } else {
            console.error("No patient found in backend.");
          }
        } catch (err) {
          console.error("Error fetching default patient:", err);
        }
      }

      setLoading(false);
    };

    initPatient();
  }, []);

  // Poll reports every 5 seconds
  useEffect(() => {
    if (!patient) return;
    const interval = setInterval(() => {
      loadReports(patient._id || patient.uuid);
    }, 5000);

    // Load immediately too
    loadReports(patient._id || patient.uuid);

    return () => clearInterval(interval);
  }, [patient]);

  const loadReports = async (patientId) => {
    if (!patientId) return;
    try {
      const res = await fetch("http://localhost:5000/api/patients?doctor_id=YOUR_DOCTOR_ID");
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Reports fetch error:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <img src="/ICON NAME.png" alt="icon" className="sidebar-icon" />
          <div className="sidebar-text">
            <span className="sidebar-main">Diabetic</span>
            <span className="sidebar-sub">Retinopathy</span>
          </div>
        </div>

        <nav className="menu">
          <div onClick={() => setActivePage("profile")}>
            <img src="/pro.png" alt="doctor" className="sidebar-icon1" />
            My Profile
          </div>
          <div onClick={() => setActivePage("report")}>
            <img src="/report.png" alt="doctor" className="sidebar-icon1" />
            Report
          </div>
          <div onClick={() => setActivePage("map")}>
            <img src="/map.png" alt="doctor" className="sidebar-icon1" />
            Map
          </div>
        </nav>

        <div className="logout-btn" onClick={handleLogout}>
          <img src="/logout.png" className="sidebar-icon1" /> Logout
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {activePage === "profile" && <PatientProfile patient={patient} />}
        {activePage === "report" && (
          <>
            <div className="section-title">My Report</div>
            <div className="card">
              {reports.length === 0 ? (
                <p>No reports yet.</p>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.prediction_id || report._id}
                    className="report-card"
                    onClick={() =>
                      setExpandedId(
                        expandedId === (report.prediction_id || report._id)
                          ? null
                          : report.prediction_id || report._id
                      )
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <p><strong>Date:</strong> {new Date(report.timestamp).toLocaleString()}</p>
                    <p><strong>Result:</strong> {report.class_name || report.severity}</p>
                    {expandedId === (report.prediction_id || report._id) && (
                      <div className="report-details">
                        {report.image_id && (
                          <img
                            src={`http://localhost:5000/api/image/${report.image_id}`}
                            alt="Report"
                            className="report-img"
                          />
                        )}
                        <p><strong>Date:</strong> {new Date(report.timestamp).toLocaleString()}</p>
                        <p><strong>Result:</strong> {report.class_name || report.severity}</p>
                        <p><strong>Confidence:</strong> {report.confidence}</p>
                        <p><strong>Recommendation:</strong> {report.recommendation || report.recommendations?.join(", ")}</p>
                        <hr />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
        {activePage === "map" && <Map />}
        <Chatbot />
      </main>
    </div>
  );
}