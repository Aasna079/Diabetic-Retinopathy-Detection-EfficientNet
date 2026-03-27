import React, { useState, useEffect } from "react";
import "./DoctorDashboard.css";
import Profile from "./Profile";
import { useNavigate } from "react-router-dom";


export default function DoctorDashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const [percentage, setPercentage] = useState(0);
  const [fileName, setFileName] = useState("");
  const [cases, setCases] = useState([]);
  const [doctor, setDoctor] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [patient, setPatient] = useState({
    name: "",
    email: "",
    date: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);

// Example patient data
  const patients = [
    { name: "Soham Adhikari", phone: "9841234567" },
    { name: "Ram Sharma", phone: "9841111111" },
    { name: "Sita Rai", phone: "9841222222" },
    { name: "Hari Thapa", phone: "9841333333" },
    { name: "Gita Karki", phone: "9841444444" },
    { name: "Priya Karki", phone: "98098744" },
    { name: "Soni Karki", phone: "980774736" },
    { name: "Surekha Karki", phone: "99378483232" },
    { name: "Somiya Karki", phone: "987376275" },
  ];

  // Filter patients by search term
  const filteredPatients = patients.filter((p) =>
    p.phone.includes(searchTerm)
  );

  const fakeDiagnosis = {
    condition: "Diabetic Retinopathy",
    severity: "Moderate",
    notes:
      "Signs of microaneurysms and mild retinal hemorrhages detected. Recommend strict blood sugar control and follow-up in 3 months.",
  };

  const fakeReports = [
    { date: "2026-03-10", result: "Retinal scan shows early-stage abnormalities." },
    { date: "2026-02-15", result: "Vision slightly blurred; possible diabetic changes observed." },
    { date: "2026-01-05", result: "Routine eye checkup. No major issues, baseline recorded." },
  ];



  /* ---------------- LOAD USER + CASES ---------------- */
  useEffect(() => {
    fetch("http://localhost:5000/api/me", {
    credentials: "include", // IMPORTANT (sends cookie)
    })
    .then(res => res.json())
    .then(data => {
      if (!data.error) {
        setDoctor(data);
      }
    })
    .catch(err => console.error("Error loading user:", err));

    fetch("http://localhost:5000/api/predictions")
      .then((res) => res.json())
      .then((data) => {
        setCases(data || []);
      })
      .catch((err) => {
        console.error("Error fetching predictions:", err);
        setCases([]);
      });
  }, []);

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
      formData.append('patient_name', 'Demo Patient');
      formData.append('patient_email', 'demo@patient.com');
      formData.append('doctor_name', doctor.name);
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

      const confidenceValue = result?.confidence || 0;
      setPercentage((confidenceValue * 100).toFixed(2));

      setPatient({
        name: 'Rena',
        email: 'rena123@gmail.com',
        date: '2026-03-24'
      });

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
            Dashboard
          </div>

          <div
            className={activePage === "mypatients" ? "active" : ""}
            onClick={() => setActivePage("mypatients")}
          >
            My Patients
          </div>

          <div
            className={activePage === "profile" ? "active" : ""}
            onClick={() => setActivePage("profile")}
          >
            Profile
          </div>
        </nav>

        {/* Logout */}
        <div className="logout-btn" onClick={handleLogout}>
          <img src="/logout.png" className="sidebar-icon1" /> Logout
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

                  {/* ── 7. mongo_id ── */}
                  <p><strong>mongo_id:</strong> {fmt(aiResult.mongo_id)}</p>

                  {/* ── 8. notes ── */}
                  <p><strong>notes:</strong> {fmt(aiResult.notes)}</p>

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

                  {/* ── 14. stored_file ── */}
                  <p><strong>stored_file:</strong> {fmt(aiResult.stored_file)}</p>

                  {/* ── 15. timestamp ── */}
                  <p><strong>timestamp:</strong> {fmt(aiResult.timestamp)}</p>

                  {/* ── 16. tta_used ── */}
                  <p>
                    <strong>tta_used:</strong>{" "}
                    {aiResult.tta_used !== undefined && aiResult.tta_used !== null
                      ? String(aiResult.tta_used)
                      : "N/A"}
                  </p>

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
          <>
            <div className="section-label">Cases Now</div>
            <div className="section-title">Live Cases</div>

            <div className="card">
              {cases.length === 0 ? (
                <div className="no-data">No live cases available</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>S.No.</th>
                      <th>Patient Name</th>
                      <th>Email</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {cases.map((c, index) => (
                      <tr key={c._id || index}>
                        <td>{index + 1}</td>
                        <td>{c.name}</td>
                        <td>{c.email}</td>
                        <td>{c.date}</td>
                        <td>
                          <button className="accept-btn">Accept</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ---------- PROFILE ---------- */}
        {activePage === "profile" && <Profile />}
      </main>
    </div>
  );
}