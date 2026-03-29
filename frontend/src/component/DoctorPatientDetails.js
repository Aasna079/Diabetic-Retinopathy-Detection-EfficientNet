import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

export default function DoctorPatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState(location.state?.patient || null);
  const [reports, setReports] = useState([]);
  const [showAllReports, setShowAllReports] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);

  // Helper for formatting nulls
  const fmt = (val) => {
    if (val === undefined) return "N/A";
    if (val === null) return "null";
    if (val === "") return '""';
    return String(val);
  };

  // Fetch patient info if page loaded directly
  useEffect(() => {
    if (!patient) {
      fetch(`http://localhost:5000/api/patient?id=${id}`)
        .then(res => res.json())
        .then(data => setPatient(data))
        .catch(err => console.error(err));
    }
  }, [id, patient]);

  // Fetch patient reports
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
    <div className="card">
      {/* Back button */}
      <button className="back-btn" onClick={() => navigate("/patients")}>
        ← Back
      </button>

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
        <div><span>Age</span><p>{patient.age || "-"}</p></div>
        <div><span>Gender</span><p>{patient.gender || "-"}</p></div>
        <div><span>Email</span><p>{patient.email || "-"}</p></div>
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
              style={{ cursor: "pointer" }}
              onClick={() =>
                setExpandedReportId(expandedReportId === report.prediction_id ? null : report.prediction_id)
              }
            >
              {/* Summary */}
              <div className="report-summary">
                <span>{report.date?.split("T")[0] || "Unknown Date"}</span>
                <span>{report.class_name || "Unknown Diagnosis"}</span>
                <span>{(report.confidence * 100)?.toFixed(2) || "-"}%</span>
              </div>

              {/* Expanded report details (OLD STYLE) */}
              {expandedReportId === report.prediction_id && (
                <div className="report-details">
                  <p><strong>class_id:</strong> {fmt(report.class_id)}</p>
                  <p><strong>class_name:</strong> {fmt(report.class_name)}</p>
                  <p><strong>confidence:</strong> {fmt(report.confidence)}</p>
                  <p><strong>doctor_id:</strong> {fmt(report.doctor_id)}</p>
                  <p><strong>filename:</strong> {fmt(report.filename)}</p>
                  <div>
                    <strong>model_metrics:</strong>
                    {report.model_metrics && Object.keys(report.model_metrics).length > 0 ? (
                      <div style={{ paddingLeft: "16px" }}>
                        <p><strong>f1_score:</strong> {fmt(report.model_metrics.f1_score)}</p>
                        <p><strong>precision:</strong> {fmt(report.model_metrics.precision)}</p>
                        <p><strong>recall:</strong> {fmt(report.model_metrics.recall)}</p>
                        <p><strong>support:</strong> {fmt(report.model_metrics.support)}</p>
                        {report.model_metrics.overall_accuracy !== undefined && (
                          <p><strong>overall_accuracy:</strong> {fmt(report.model_metrics.overall_accuracy)}</p>
                        )}
                      </div>
                    ) : <span>{"{}"}</span>}
                  </div>
                  <p><strong>patient_id:</strong> {fmt(report.patient_id)}</p>
                  <p><strong>prediction_id:</strong> {fmt(report.prediction_id)}</p>
                  <div>
                    <strong>Probabilities:</strong>
                    {report.probabilities && Object.keys(report.probabilities).length > 0 ? (
                      <div style={{ paddingLeft: "16px" }}>
                        {Object.entries(report.probabilities)
                          .sort((a, b) => a[1] - b[1])
                          .map(([key, value]) => (
                            <p key={key}><strong>{key}:</strong> {value}</p>
                        ))}
                      </div>
                    ) : <span>N/A</span>}
                  </div>
                  <p><strong>Recommendation:</strong> {fmt(report.recommendation)}</p>
                  <p><strong>severity:</strong> {fmt(report.severity)}</p>
                  <p><strong>timestamp:</strong> {fmt(report.timestamp)}</p>
                  {report.high_risk_flag !== undefined && (
                    <p>
                      <strong>high_risk_flag:</strong>{" "}
                      <span style={{ color: report.high_risk_flag ? "red" : "green" }}>
                        {String(report.high_risk_flag)}
                      </span>
                    </p>
                  )}
                  {report.warning && (
                    <>
                      <p><strong style={{ color: "red" }}>warning:</strong></p>
                      <p style={{ paddingLeft: "16px" }}>{report.warning}</p>
                    </>
                  )}
                  {report.second_opinion && (
                    <>
                      <p><strong>second_opinion:</strong></p>
                      <p style={{ paddingLeft: "16px" }}>{report.second_opinion}</p>
                    </>
                  )}
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
  );
}