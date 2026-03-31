import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "./DoctorPatientDetails.css";

export default function DoctorPatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState(location.state?.patient || null);
  const [reports, setReports] = useState([]);
  const [showAllReports, setShowAllReports] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);

  const fmt = (val) => {
    if (val === undefined) return "N/A";
    if (val === null) return "null";
    if (val === "") return '""';
    return String(val);
  };

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

  useEffect(() => {
    if (!patient) {
      fetch(`http://localhost:5000/api/patient?id=${id}`)
        .then(res => res.json())
        .then(data => setPatient(data))
        .catch(err => console.error(err));
    }
  }, [id, patient]);

  useEffect(() => {
    if (patient) {
      fetch(`http://localhost:5000/api/patient_reports?patient_id=${patient.uuid}`)
        .then(res => res.json())
        .then(data => setReports(data))
        .catch(err => console.error(err));
    }
  }, [patient]);

  if (!patient) return <div>Loading patient...</div>;

  return (
    <div className="patient-details-page">
      <div className="patient-details-container">
        <div className="top-row">
          <button className="back-btn" onClick={() => navigate("/patients")}>
            ← Back
          </button>
        </div>

        {/* Patient basic info + status */}
        <div className="patient-basic">
          <div>
            <h2>{patient.name}</h2>
            <p className="patient-meta">Number: {patient.phone}</p>
          </div>
          <span className="status-badge">{patient.status || "Active"}</span>
        </div>

        {/* Patient detailed info */}
        <div className="info-grid">
          <div><span>Email</span><p>{patient.email || "-"}</p></div>
          <div><span>Age</span><p>{patient.age || "-"}</p></div>
          <div><span>Gender</span><p>{patient.gender || "-"}</p></div>
          <div><span>Blood Group</span><p>{patient.bloodGroup || "-"}</p></div>
          <div><span>Address</span><p>{patient.address || "-"}</p></div>
        </div>

        {/* Diagnose button */}
        <div className="action-bar">
          <button
            className="diagnose-btn"
            onClick={() => navigate("/DoctorDashboard", { state: { patient } })}
          >
            + Diagnose Patient
          </button>
        </div>

        {/* Reports */}
        <h3>Reports</h3>
        {reports.length > 0 ? (
          <>
            {(showAllReports ? reports : reports.slice(0, 3)).map((report, index) => (
              <div
                key={report.prediction_id || index}
                className="report-row"
                onClick={() =>
                  setExpandedReportId(expandedReportId === report.prediction_id ? null : report.prediction_id)
                }
              >
                {/* Summary */}
                <div className="report-summary">
                  <span><p>{formatDateOnly(report.timestamp)}</p></span>
                  <span className="report-toggle">
                    {expandedReportId === report.prediction_id ? "▲" : "▼"}
                  </span>
                </div>

                {/* Expanded report details */}
                {expandedReportId === report.prediction_id && (
                  <div
                    className="report-details"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {report.image_id && (
                      <div className="report-image">
                        <img
                          src={`http://localhost:5000/api/image/${report.image_id}`}
                          alt="Report"
                        />
                      </div>
                    )}<br /><br />
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
                                <div className="pre">{key}:</div> {value}
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

            {reports.length > 3 && (
              <button className="show-more-btn" onClick={() => setShowAllReports(!showAllReports)}>
                {showAllReports ? "Show Less ▲" : "Show More ▼"}
              </button>
            )}
          </>
        ) : (
          <p className="empty-text">No reports yet</p>
        )}
      </div>
    </div>
  );
}