import React, { useState, useEffect } from "react";
import "./PatientDashboard.css";
import PatientProfile from "./PatientProfile";

export default function PatientDashboard() {
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activePage, setActivePage] = useState("dashboard");
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

    window.location.href = "/login";
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
    <div onClick={() => setActivePage("profile")}>My Profile</div>
    <div onClick={() => setActivePage("appointments")}>Appointments</div>
    <div onClick={() => setActivePage("messages")}>Messages</div>
    <div onClick={() => setActivePage("report")}>Report</div>
    <div onClick={() => setActivePage("dashboard")}>Total</div>
  </nav>

  {/* 🔴 Logout ALWAYS at bottom */}
  <div className="logout-btn" onClick={handleLogout}>
    <img src="/logout.png" className="sidebar-icon1" /> Logout
  </div>
</aside>

      {/* Main */}
      <main className="main">
        {activePage === "dashboard" && (
          <>
            <div className="welcome-box">
              <h2>Hello {patient?.name || ""}</h2>
              <p>Your altogether service.</p>
            </div>

            <div className="quick-stats">
              <div
                className="stat-card clickable"
                onClick={() => setActivePage("appointments")}
              >
                <h3>{appointments.length}</h3>
                <p>Total Appointments</p>
              </div>

              <div
                className="stat-card clickable"
                onClick={() => setActivePage("messages")}
              >
                <h3>{messages.length}</h3>
                <p>Total Messages</p>
              </div>
            </div>
          </>
        )}

        {activePage === "appointments" && (
          <>
            <div className="section-title">My Appointments</div>
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Doctor</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr>
                      <td colSpan="5">No Appointments</td>
                    </tr>
                  ) : (
                    appointments.map((a, index) => (
                      <tr key={a._id || index}>
                        <td>{index + 1}</td>
                        <td>{a.doctorName || "N/A"}</td>
                        <td>{a.date || "N/A"}</td>
                        <td>{a.time || "N/A"}</td>
                        <td className={`status ${a.status?.toLowerCase()}`}>
                          {a.status || "Pending"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activePage === "messages" && (
          <>
            <div className="section-title">Messages</div>
            <input
              type="text"
              placeholder="Search messages..."
              className="search-box"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="card">
              {filteredMessages.length === 0 ? (
                <p>No messages found</p>
              ) : (
                filteredMessages.map((m, index) => (
                  <div key={m._id || index} className="message-box">
                    <strong>From: {m.from || "Doctor"}</strong>
                    <p>{m.content || "No content"}</p>
                  </div>
                ))
              )}
            </div>
          </>
        )}

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
                    <input value={reportData?.patient?.name || patient?.name || ""} readOnly />
                    <input value={reportData?.patient?.id || patient?._id || ""} readOnly />
                    <input value={reportData?.patient?.email || patient?.email || ""} readOnly />
                    <input value={reportData?.patient?.date || ""} readOnly />
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

        {activePage === "profile" && <PatientProfile />}
      </main>
    </div>
  );
}