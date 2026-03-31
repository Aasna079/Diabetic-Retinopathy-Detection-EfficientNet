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
  const [showAllReports, setShowAllReports] = useState(false);

  const formatDateOnly = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kathmandu"
    });
  };

  const fmt = (val) => {
    if (val === undefined) return "N/A";
    if (val === null) return "null";
    if (val === "") return '""';
    return String(val);
  };

  useEffect(() => {
    fetch("http://localhost:5000/api/patient_from_token", {
      credentials: "include"
    })
      .then(res => {
        if (res.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setPatient(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!patient) return;

    const fetchReports = () => {
      fetch(`http://localhost:5000/api/patient_reports?patient_id=${patient.uuid}`)
        .then(res => res.json())
        .then(data => setReports(data))
        .catch(err => console.error(err));
    };

    fetchReports();
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, [patient]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div className="dashboard">
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

      <main className="main">
        {activePage === "profile" && <PatientProfile patient={patient} />}

        {activePage === "report" && (
          <>
            <div className="section-title">My Reports</div>
            <div className="card">
              {reports.length === 0 ? (
                <p className="empty-text">No reports yet.</p>
              ) : (
                <>
                  {(showAllReports ? reports : reports.slice(0, 5)).map((report) => (
                    <div
                      key={report.prediction_id || report._id}
                      className="report-row"
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setExpandedId(
                          expandedId === (report.prediction_id || report._id)
                            ? null
                            : report.prediction_id || report._id
                        )
                      }
                    >
                      {/* Summary */}
                      <div className="report-summary">
                        <span><p>{formatDateOnly(report.timestamp)}</p></span>
                        <span className="report-toggle">
                          {expandedId === (report.prediction_id || report._id) ? "▲" : "▼"}
                        </span>
                      </div>

                      {/* Expanded details */}
                      {expandedId === (report.prediction_id || report._id) && (
                        <div className="report-details"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {report.image_id && (
                            <div className="report-image">
                              <img
                                src={`http://localhost:5000/api/image/${report.image_id}`}
                                alt="Report"
                              />
                            </div>
                          )}
                          <br />
                          <p><strong>Date:</strong> {formatDateOnly(report.timestamp)}</p>
                          <p><strong>Class_id:</strong> {fmt(report.class_id)}</p>
                          <p><strong>Class_name:</strong> {fmt(report.class_name)}</p>
                          <p><strong>Confidence:</strong> {fmt(report.confidence)}</p>
                          <p><strong>Doctor_id:</strong> {fmt(report.doctor_id)}</p>
                          <p><strong>Filename:</strong> {fmt(report.filename)}</p>

                          <div>
                            <hr />
                            <strong>Model_metrics:</strong>
                            {report.model_metrics && Object.keys(report.model_metrics).length > 0 ? (
                              <div style={{ paddingLeft: "16px" }}>
                                <p className="probpre"><div className="pre">F1_score:</div> {fmt(report.model_metrics.f1_score)}</p>
                                <p className="probpre"><div className="pre">Precision:</div> {fmt(report.model_metrics.precision)}</p>
                                <p className="probpre"><div className="pre">Recall:</div> {fmt(report.model_metrics.recall)}</p>
                                <p className="probpre"><div className="pre">Support:</div> {fmt(report.model_metrics.support)}</p>
                                {report.model_metrics.overall_accuracy !== undefined && (
                                  <p><strong>overall_accuracy:</strong> {fmt(report.model_metrics.overall_accuracy)}</p>
                                )}
                              </div>
                            ) : <span>{"{}"}</span>}
                          </div>

                          <hr />
                          <p><strong>Patient_id:</strong> {fmt(report.patient_id)}</p>
                          <p><strong>Prediction_id:</strong> {fmt(report.prediction_id)}</p>

                          <div>
                            <hr />
                            <strong>Probabilities:</strong>
                            {report.probabilities && Object.keys(report.probabilities).length > 0 ? (
                              <div style={{ paddingLeft: "16px" }}>
                                {(() => {
                                  const sortedProbs = Object.entries(report.probabilities)
                                    .sort((a, b) => a[1] - b[1]);
                                  const maxKey = sortedProbs[sortedProbs.length - 1]?.[0];
                                  return sortedProbs.map(([key, value]) => (
                                    <p
                                      key={key}
                                      className={`probpre ${key === maxKey ? "highlighted-p" : ""}`}
                                    >
                                      <div className="pre">{key}:</div> <div className="value">{value}</div>
                                    </p>
                                  ));
                                })()}
                              </div>
                            ) : <span>N/A</span>}
                          </div>

                          <hr />
                          <p className="reco">
                            <strong className="reco1">Recommendation:</strong>
                            <div className="reco2">{fmt(report.recommendation)}</div>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {reports.length > 5 && (
                    <button className="show-more-btn" onClick={() => setShowAllReports(!showAllReports)}>
                      {showAllReports ? "Show Less ▲" : "Show More ▼"}
                    </button>
                  )}
                </>
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