import React, { useState, useEffect } from "react";
import "./PatientDashboard.css";
import PatientProfile from "./PatientProfile";
import Chatbot from "./Chatbot";
import Map from "./Map";

export default function PatientDashboard() {
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activePage, setActivePage] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reportData, setReportData] = useState(null);


  useEffect(() => {
    const loadAll = async () => {
      try {
        loadPatient();
        loadReport();
        await Promise.all([loadAppointments(), loadMessages()]);
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const loadPatient = () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setPatient(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error("LocalStorage error:", err);
    }
  };

  const loadReport = () => {
    try {
      const storedReport = localStorage.getItem("patientReport");
      if (storedReport) {
        setReportData(JSON.parse(storedReport));
      }
    } catch (err) {
      console.error("Report load error:", err);
    }
  };

  const loadAppointments = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/appointments");
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Appointments fetch error:", err);
  }
};

const loadMessages = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/messages");
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Messages fetch error:", err);
  }
};

  const filteredMessages = messages.filter((m) =>
    m.content?.toLowerCase().includes(search.toLowerCase())
  );

  const getDRStage = (value) => {
    if (value <= 10) return "No Diabetic Retinopathy";
    if (value <= 25) return "Mild Diabetic Retinopathy";
    if (value <= 50) return "Moderate Diabetic Retinopathy";
    if (value <= 75) return "Severe Diabetic Retinopathy";
    return "Proliferative Diabetic Retinopathy";
  };

  // ✅ Logout Function
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("patientReport");

    window.location.href = "/";
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
  <div className="sidebar-title">
    <img src="/ICON NAME.png" alt="icon" className="sidebar-icon" />
    <div className="sidebar-text">
      <span className="sidebar-main">Diabetic</span>
      <span className="sidebar-sub">Retinal Neuropathy</span>
    </div>
  </div>

  {/* Menu */}
  <nav className="menu">
    <div onClick={() => setActivePage("profile")}>   <img src="/pro.png" alt="doctor" className="sidebar-icon1" />My Profile</div>
    <div onClick={() => setActivePage("report")}><img src="/report.png" alt="doctor" className="sidebar-icon1" />Report</div>
    <div onClick={() => setActivePage("map")}><img src="/map.png" alt="doctor" className="sidebar-icon1" />Map</div>

  </nav>

  {/* Logout*/}
  <div className="logout-btn" onClick={handleLogout}>
    <img src="/logout.png" className="sidebar-icon1" /> Logout
  </div>
</aside>

      {/* Main */}
      <main className="main">
        {activePage === "profile" && <PatientProfile />}

        {activePage === "report" && (
          <>
            <div className="section-title">My Report</div>
            <div className="card">
              {!reportData ? (
                <p>No report available yet.</p>
              ) : (
                <div className="patient-report">
                  <h3 style={{ color: "#16a34a" }}>Patient Examination Report</h3>
                  <div className="patient-form">
                    <div className="patient-form">
                              <input value={reportData?.patient?.name || patient?.name || ""} readOnly />
                              <input value={reportData?.patient?.phone || patient?.phone || ""} readOnly />
                              <input value={reportData?.patient?.email || patient?.email || ""} readOnly />
                              <input value={reportData?.patient?.date || ""} readOnly />
                              </div>
                  </div>
                  <hr />
                  <p><strong>DR Percentage:</strong> {reportData.percentage}%</p>
                  <p>
                    <strong>DR Stage:</strong>{" "}
                    <span className="dr-stage">{getDRStage(reportData.percentage)}</span>
                  </p>
                  <p className="medical-note">
                    Patient diagnosed with <b>{getDRStage(reportData.percentage)}</b>.
                  </p>
                </div>
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