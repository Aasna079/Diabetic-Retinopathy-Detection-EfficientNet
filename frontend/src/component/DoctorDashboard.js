import React, { useState, useEffect } from "react";
import "./DoctorDashboard.css";
import Profile from "./Profile";
import { useNavigate } from "react-router-dom";


export default function DoctorDashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const [percentage, setPercentage] = useState(0);
  const [fileName, setFileName] = useState("");
  const [doctor, setDoctor] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedPatientForDiagnosis, setSelectedPatientForDiagnosis] = useState(null);
  const [patient, setPatient] = useState({
    name: "",
    email: "",
    date: "",
    id: ""
  });
  const [showAllReports, setShowAllReports] = useState(false); // for show more button
  const [expandedReportId, setExpandedReportId] = useState(null); // which report is expanded
  const handleBackToPatientList = () => {
    setSelectedPatient(null);
    setSelectedPatientForDiagnosis(null);
    setAiResult(null);
    setPercentage(0);
    setFileName("");
    setPatient({ name: "", email: "", date: "", id: "" });
    setExpandedReportId(null);
    setShowAllReports(false);
    setSearchTerm("");          // reset search
    setActivePage("mypatients"); // ensure page switches
  };

// // Example patient data
//   const patients = [
//     { name: "Soham Adhikari", phone: "9841234567" },
//     { name: "Ram Sharma", phone: "9841111111" },
//     { name: "Sita Rai", phone: "9841222222" },
//     { name: "Hari Thapa", phone: "9841333333" },
//     { name: "Gita Karki", phone: "9841444444" },
//     { name: "Priya Karki", phone: "98098744" },
//     { name: "Soni Karki", phone: "980774736" },
//     { name: "Surekha Karki", phone: "99378483232" },
//     { name: "Somiya Karki", phone: "987376275" },
//   ];

  // Filter patients by search term
  const filteredPatients = patients.filter((p) =>
    (p.phone || "").includes(searchTerm)
  );

//   const fakeDiagnosis = {
//     condition: "Diabetic Retinopathy",
//     severity: "Moderate",
//     notes:
//       "Signs of microaneurysms and mild retinal hemorrhages detected. Recommend strict blood sugar control and follow-up in 3 months.",
//   };

//   const fakeReports = [
//     { date: "2026-03-10", result: "Retinal scan shows early-stage abnormalities." },
//     { date: "2026-02-15", result: "Vision slightly blurred; possible diabetic changes observed." },
//     { date: "2026-01-05", result: "Routine eye checkup. No major issues, baseline recorded." },
//   ];



  /* ---------------- LOAD USER + CASES ---------------- */
  useEffect(() => {
  // Load doctor info
  fetch("http://localhost:5000/api/me", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (!data.error) {
        setDoctor(data);

        // Fetch real patients for this doctor
        fetch(`http://localhost:5000/api/patients?doctor_id=${data.uuid}`)
          .then(res => res.json())
          .then(patientsData => {
            console.log("Patients from backend:", patientsData);
            setPatients(patientsData);
          })
          .catch(err => console.error("Error fetching patients:", err));
      }
    })
    .catch(err => console.error("Error loading user:", err));
    
}, []);

  // Load reports whenever a patient is selected
  useEffect(() => {
    if (selectedPatient) {
      fetch(`http://localhost:5000/api/patient_reports?patient_id=${selectedPatient.uuid}`)
        .then(res => res.json())
        .then(data => {
          // add the reports to the selectedPatient object
          setSelectedPatient(prev => ({
            ...prev,
            reports: data
          }));
        })
        .catch(err => console.error("Error fetching patient reports:", err));
    }
  }, [selectedPatient]);
 
  useEffect(() => {
    if (activePage !== "dashboard") {
      setAiResult(null);
      setFileName("");
      setPercentage(0);
      setPatient({ name: "", email: "", date: "", id: "" });
      setSelectedPatientForDiagnosis(null);
    } else {
      // When entering dashboard but no patient was selected for diagnosis
      if (!selectedPatientForDiagnosis) {
        setPatient({ name: "", email: "", date: "", id: "" });
        setAiResult(null);
        setPercentage(0);
        setFileName("");
      }
    }
  }, [activePage]);

  /* ---------------- FILE UPLOAD ---------------- */
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setAiResult(null);

    try {
      // 🚨 STOP upload if doctor not loaded
      if (!doctor) {
        alert("Doctor not loaded yet. Please wait.");
        return;
      }

      // ✅ Debug (very important)
      console.log("Doctor being sent:", doctor);

      const formData = new FormData();
      if (selectedPatientForDiagnosis) {
        formData.append('patient_id', selectedPatientForDiagnosis.uuid);
        formData.append('patient_name', selectedPatientForDiagnosis.name);
        formData.append('patient_email', selectedPatientForDiagnosis.email);
      } else {
        formData.append('patient_id', null);
      }
      formData.append('doctor_id', doctor.uuid);
      formData.append('image', file);

      console.log('🚀 Uploading to backend API: http://localhost:5000/api/predict');

      const response = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ AI Analysis Result:', result);

      setAiResult(result);

      // Only attach report if a patient is selected for diagnosis
      if (selectedPatientForDiagnosis) {
        const newReport = {
          ...result,
          date: new Date().toISOString(),
          prediction_id: result.prediction_id || `${Date.now()}-${Math.random()}`,
        };

        setSelectedPatient(prev => ({
          ...prev,
          reports: prev.reports ? [newReport, ...prev.reports] : [newReport],
        }));
      }

      const confidenceValue = result?.confidence || 0;
      setPercentage((confidenceValue * 100).toFixed(2));

      if (selectedPatientForDiagnosis) {
        setPatient({
          name: selectedPatientForDiagnosis.name,
          email: selectedPatientForDiagnosis.email,
          date: new Date().toISOString().split("T")[0], // today
          id: selectedPatientForDiagnosis.uuid
        });
      } else {
        setPatient({ name: '', email: '', date: '', id: '' });
      }

    } catch (error) {
      console.error('❌ Upload failed:', error);
      alert('AI Analysis failed. Make sure backend is running (python app.py)\nError: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // ✅ Logout Function
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("patientReport");
    window.location.href = "/";
  };

  /* ---------------- FORM CHANGE ---------------- */
  const handlePatientChange = (e) => {
    const updatedPatient = {
      ...patient,
      [e.target.name]: e.target.value,
    };
    setPatient(updatedPatient);
    if (percentage > 0) {
      localStorage.setItem(
        "patientReport",
        JSON.stringify({ percentage: percentage, patient: updatedPatient })
      );
    }
  };

  /* ---------------- HELPER: show null as "null", missing as "N/A" ---------------- */
  const fmt = (val) => {
    if (val === undefined) return "N/A";
    if (val === null) return "null";
    if (val === "") return '""';
    return String(val);
  };

  return (
    <div className="dashboard">
      {/* ================= SIDEBAR ================= */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <img src="/ICON NAME.png" alt="icon" className="sidebar-icon" />
          <div className="sidebar-text">
            <span className="sidebar-main">Diabetic</span>
            <span className="sidebar-sub">Retinopathy</span>
          </div>
        </div>

        <nav>
          <div
            className={activePage === "dashboard" ? "active" : ""}
            onClick={() => setActivePage("dashboard")}
          >
            <img src="/dashboard.png" alt="dashboard" className="menu-icon" />
            Dashboard
          </div>

          <div
            className={activePage === "mypatients" ? "active" : ""}
            onClick={() => setActivePage("mypatients")}
          >
            <img src="/pat.png" alt="patients" className="menu-icon" />
            My Patients
          </div>

          <div
            className={activePage === "profile" ? "active" : ""}
            onClick={() => setActivePage("profile")}
          >
            <img src="/patient.png" alt="profile" className="menu-icon" />
            Profile
          </div>
        </nav>

        <div className="logout-btn" onClick={handleLogout}>
          <img src="/logout.png" alt="logout" className="sidebar-icon1" />
          Logout
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main className="main">
        {/* Welcome Doctor */}
        {doctor && <h2 className="welcome-text">Welcome Dr. {doctor?.name}</h2>}

        {/* ---------- DASHBOARD ---------- */}
        {activePage === "dashboard" && (
          <>
            <div className="upload-section">
              <div className="upload-box">
                <div className="upload-left">
                  <span className="upload-icon">⬆</span>
                  <div>
                    <strong>Upload Retinal Fundus Image</strong>
                    <small>Supported formats: JPG, PNG</small>
                    {fileName && <p className="file-name">{fileName}</p>}
                  </div>
                </div>

                <input
                  type="file"
                  id="fileUpload"
                  hidden
                  onChange={handleFileChange}
                />

                <label htmlFor="fileUpload" className="upload-btn">
                  {uploading ? "Analyzing..." : "Upload"}
                </label>
              </div>
            </div>

            <div>REPORT ANALYSIS</div>

            <div className="upload-section card">
              {aiResult && (
                <div className="patient-report">
                  <h3 style={{ color: "#16a34a" }}>Patient Examination Report</h3>

                  {/* Patient Form */}
                  <div className="patient-form">
                    <input
                      name="name"
                      placeholder="Patient Name"
                      value={patient.name}
                      onChange={handlePatientChange}
                    />
                    <input
                      name="email"
                      placeholder="Patient Email"
                      value={patient.email}
                      onChange={handlePatientChange}
                    />
                    <input
                      type="date"
                      name="date"
                      value={patient.date}
                      onChange={handlePatientChange}
                    />
                  </div>

                  <hr />

                  {/* ── 1. class_id ── */}
                  <p><strong>class_id:</strong> {fmt(aiResult.class_id)}</p>

                  {/* ── 2. class_name ── */}
                  <p><strong>class_name:</strong> {fmt(aiResult.class_name)}</p>

                  {/* ── 3. confidence ── */}
                  <p>
                    <strong>confidence:</strong>{" "}
                    {aiResult.confidence !== undefined && aiResult.confidence !== null
                      ? aiResult.confidence
                      : "N/A"}
                  </p>

                  {/* ── 4. doctor_id ── */}
                  <p><strong>doctor_id:</strong> {fmt(aiResult.doctor_id)}</p>

                  {/* ── 5. filename ── */}
                  <p><strong>filename:</strong> {fmt(aiResult.filename)}</p>

                  <hr />

                  {/* ── 6. model_metrics ── */}
                  <div>
                    <strong>model_metrics:</strong>
                    {aiResult.model_metrics && Object.keys(aiResult.model_metrics).length > 0 ? (
                      <div style={{ paddingLeft: "16px" }}>
                        <p><strong>f1_score:</strong> {fmt(aiResult.model_metrics.f1_score)}</p>
                        <p><strong>precision:</strong> {fmt(aiResult.model_metrics.precision)}</p>
                        <p><strong>recall:</strong> {fmt(aiResult.model_metrics.recall)}</p>
                        <p><strong>support:</strong> {fmt(aiResult.model_metrics.support)}</p>
                        {aiResult.model_metrics.overall_accuracy !== undefined && (
                          <p><strong>overall_accuracy:</strong> {fmt(aiResult.model_metrics.overall_accuracy)}</p>
                        )}
                      </div>
                    ) : (
                      <span> {"{}"}</span>
                    )}
                  </div>

                  <hr />

                  {/* ── 9. patient_id ── */}
                  <p><strong>patient_id:</strong> {fmt(aiResult.patient_id)}</p>

                  {/* ── 10. prediction_id ── */}
                  <p><strong>prediction_id:</strong> {fmt(aiResult.prediction_id)}</p>

                  <hr />

                  {/* ── 11. probabilities ── */}
                  <div>
                    <strong>Probabilities:</strong>
                    {aiResult.probabilities && Object.keys(aiResult.probabilities).length > 0 ? (
                      <div style={{ paddingLeft: "16px" }}>
                        {Object.entries(aiResult.probabilities)
                          .sort((a, b) => a[1] - b[1]) // sort descending
                          .map(([key, value]) => (
                            <p key={key}>
                              <strong>{key}:</strong> {value}
                            </p>
                        ))}
                      </div>
                    ) : (
                      <span> N/A</span>
                    )}
                  </div>

                  <hr />

                  {/* ── 12. recommendation ── */}
                  <p><strong>Recommendation:</strong></p>
                  <p style={{ paddingLeft: "16px" }}>{fmt(aiResult.recommendation)}</p>

                  <hr />

                  {/* ── 13. severity ── */}
                  <p><strong>severity:</strong> {fmt(aiResult.severity)}</p>

                  {/* ── 15. timestamp ── */}
                  <p><strong>timestamp:</strong> {fmt(aiResult.timestamp)}</p>

                  <hr />

                  {/* ── 17. high_risk_flag ── */}
                  {aiResult.high_risk_flag !== undefined && (
                    <p>
                      <strong>high_risk_flag:</strong>{" "}
                      <span style={{ color: aiResult.high_risk_flag ? "red" : "green" }}>
                        {String(aiResult.high_risk_flag)}
                      </span>
                    </p>
                  )}

                  {/* ── 18. warning (only when backend sends it) ── */}
                  {aiResult.warning && (
                    <>
                      <hr />
                      <p><strong style={{ color: "red" }}>warning:</strong></p>
                      <p style={{ paddingLeft: "16px" }}>{aiResult.warning}</p>
                    </>
                  )}

                  {/* ── 19. second_opinion (only when backend sends it) ── */}
                  {aiResult.second_opinion && (
                    <>
                      <hr />
                      <p><strong>second_opinion:</strong></p>
                      <p style={{ paddingLeft: "16px" }}>{aiResult.second_opinion}</p>
                    </>
                  )}

                </div>
              )}
            </div>
          </>
        )}

                {/* ---------- MY PATIENTS ---------- */}
        {activePage === "mypatients" && (
          <div className="card">
            <div className="top-bar">     
              {!selectedPatient ? (
                <div className="search-container">
              
                  <input
                    type="text"
                    placeholder="Search by phone number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              ) : (
                <button
                  className="back-btn"
                  onClick={() => {
                    setSelectedPatient(null);
                  }}
                >
                  ← Back
                </button>
              )}
            </div>

            {/* Patient list */}
            {!selectedPatient && (
              <>
                <div className="patient-header">
                  <div className="sn">S.N.</div>
                  <div className="name">Name</div>
                  <div className="phone">Phone no.</div>
                </div>

                <div className="patient-list">
                  {filteredPatients.map((p, index) => (
                    <div
                      className="patient-row"
                      key={index}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelectedPatient({
                          ...p,
                          diagnosis: null,  // empty for now
                          reports: [], 
                        })
                      }
                    >
                      <div className="sn">{index + 1}.</div>
                      <div className="name">{p.name}</div>
                      <div className="phone">{p.phone}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Selected patient details */}
            {selectedPatient && (
              <>
                <div className="patient-header">
                  <p className="breadcrumb">Patient</p>
                  <div className="patient-top">
                    <div className="patient-basic">
                      <div>
                        <h2>{selectedPatient.name}</h2>
                        <p className="patient-meta">Number: {selectedPatient.phone}</p>
                      </div>
                      <span className="status-badge">{selectedPatient.status || "Active"}</span>
                    </div>
                  </div>
                </div>

                <div className="patient-section">
                  <h3>Personal Information</h3>
                  <div className="info-grid">
                    <div>
                      <span>Patient Name</span>
                      <p>{selectedPatient.name}</p>
                    </div>
                    <div>
                      <span>Age</span>
                      <p>{selectedPatient.age || "-"}</p>
                    </div>
                    <div>
                      <span>Gender</span>
                      <p>{selectedPatient.gender || "-"}</p>
                    </div>
                    <div>
                      <span>Email</span>
                      <p>{selectedPatient.email || "-"}</p>
                    </div>
                    <div>
                      <span>Phone Number</span>
                      <p>{selectedPatient.phone}</p>
                    </div>
                    <div>
                      <span>Blood Group</span>
                      <p>{selectedPatient.bloodGroup || "-"}</p>
                    </div>
                    <div>
                      <span>Address</span>
                      <p>{selectedPatient.address || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="action-bar">
                  <button
                    className="diagnose-btn"
                    onClick={() => {
                      // 1. Store selected patient for diagnosis
                      setSelectedPatientForDiagnosis(selectedPatient);

                      // 2. Switch to dashboard
                      setActivePage("dashboard");
                    }}
                  >
                    + Diagnose Patient
                  </button>
                </div>


                <div className="patient-section">
                  <h3>Reports</h3>
                  {selectedPatient.reports && selectedPatient.reports.length > 0 ? (
                    <>
                      {(showAllReports
                        ? selectedPatient.reports
                        : selectedPatient.reports.slice(0, 3) // first 3 reports by default
                      ).map((report, index) => (
                        <div
                          key={report.prediction_id || index}
                          className="report-row"
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setExpandedReportId(
                              expandedReportId === report.prediction_id
                                ? null
                                : report.prediction_id
                            )
                          }
                        >
                          <div className="report-summary">
                            <span>{report.date?.split("T")[0] || "Unknown Date"}</span>
                            <span>{report.class_name || "Unknown Diagnosis"}</span>
                            <span>{(report.confidence * 100)?.toFixed(2) || "-"}%</span>
                          </div>

                          {/* Expanded report details */}
                          {expandedReportId === report.prediction_id && (
                            <div className="report-details">
                              <p><strong>Condition:</strong> {report.class_name}</p>
                              <p><strong>Severity:</strong> {report.severity}</p>
                              <p><strong>Confidence:</strong> {(report.confidence*100).toFixed(2)}%</p>
                              <p><strong>Notes:</strong> {report.notes || "-"}</p>
                              <p><strong>Recommendation:</strong> {report.recommendation || "-"}</p>
                              <p><strong>Filename:</strong> {report.filename}</p>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Show More / Show Less */}
                      {selectedPatient.reports.length > 3 && (
                        <button
                          className="show-more-btn"
                          onClick={() => setShowAllReports(!showAllReports)}
                        >
                          {showAllReports ? "Show Less ▲" : "Show More ▼"}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="empty-text">No reports yet</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}


        {/* ---------- PROFILE ---------- */}
        {activePage === "profile" && <Profile />}
      </main>
    </div>
  );
}