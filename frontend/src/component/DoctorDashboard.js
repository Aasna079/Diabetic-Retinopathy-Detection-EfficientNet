import React, { useState, useEffect } from "react";
import "./DoctorDashboard.css";
import Profile from "./Profile";

export default function DoctorDashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const [percentage, setPercentage] = useState(0);
  const [fileName, setFileName] = useState("");
  const [cases, setCases] = useState([]);
  const [doctor, setDoctor] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [patient, setPatient] = useState({
    name: "",
    id: "",
    email: "",
    date: "",
  });

  /* ---------------- LOAD USER + CASES ---------------- */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setDoctor(JSON.parse(storedUser));
    }

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
      const formData = new FormData();
      formData.append('image', file);
      formData.append('patient_id', 'patient_' + Date.now());
      formData.append('patient_name', patient.name || 'Unknown Patient');

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
      
      const confidenceValue = result.confidence;
      setPercentage(confidenceValue * 100);
      
      setPatient({
        name: result.patient?.name || 'Patient ' + (result.patient?.id || 'Unknown'),
        id: result.patient?.id || 'Unknown',
        email: result.patient?.email || 'patient@example.com',
        date: new Date().toLocaleDateString(),
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      
      setPercentage(42);
      setPatient({
        name: 'Demo Patient',
        id: 'DEMO123',
        email: 'demo@patient.com',
        date: new Date().toLocaleDateString(),
      });
      
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

    // If report already exists, keep it updated too
    if (percentage > 0) {
      localStorage.setItem(
        "patientReport",
        JSON.stringify({
          percentage: percentage,
          patient: updatedPatient,
        })
      );
    }
  };

  return (
    <div className="dashboard">
      {/* ================= SIDEBAR ================= */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <img src="/ICON NAME.png" alt="icon" className="sidebar-icon" />
          <div className="sidebar-text">
            <span className="sidebar-main">Diabetic</span>
            <span className="sidebar-sub">Retinal Neuropathy</span>
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
          {/* Logout*/}
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
                  Upload
                </label>
              </div>

              <div className="percentage-bar">
                Diabetic Retinopathy Percentage: <b>{percentage}%</b>
              </div>
            </div>

            <div>REPORT ANALYSIS</div>

            <div className="upload-section card">
              {/* REPORT */}
              {percentage > 0 && (
                <div className="patient-report">
                  <h3 style={{ color: "#16a34a" }}>
                    Patient Examination Report
                  </h3>

                  <div className="patient-form">
                    <input
                      name="name"
                      placeholder="Patient Name"
                      value={patient.name}
                      onChange={handlePatientChange}
                    />

                    <input
                      name="id"
                      placeholder="Patient ID"
                      value={patient.id}
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

                  <p>
                    <strong>DR Percentage:</strong> {percentage}%
                  </p>

                  <p>
                    <strong>DR Stage:</strong>{" "}
                    <span className="dr-stage">
                      {aiResult?.severity || "Stage not available"}
                    </span>
                  </p>
                  {aiResult?.recommendations && (
                    <div className="recommendations">
                      <strong>Recommendations:</strong>
                      <ul>
                        {aiResult.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="medical-note">
                    Patient diagnosed with <b>{aiResult?.severity}</b>.
                  </p>
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