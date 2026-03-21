import React, { useState, useEffect } from "react";
import "./DoctorDashboard.css";
import Profile from "./Profile";

export default function DoctorDashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const [percentage, setPercentage] = useState(0);
  const [fileName, setFileName] = useState("");
  const [cases, setCases] = useState([]);
  const [doctor, setDoctor] = useState(null);
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

    fetch("http://localhost:5000/api/cases")
      .then((res) => res.json())
      .then((data) => setCases(Array.isArray(data) ? data : []))
      .catch(() => setCases([]));
  }, []);

  /* ---------------- FILE UPLOAD ---------------- */
  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      const result = 42; // test value
      setFileName(file.name);
      setPercentage(result);

      // Save report so patient can also see it
      localStorage.setItem(
        "patientReport",
        JSON.stringify({
          percentage: result,
          patient: {
            ...patient,
          },
        })
      );
    }
  };

  /* ---------------- DR STAGE ---------------- */
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
                      {getDRStage(percentage)}
                    </span>
                  </p>

                  <p className="medical-note">
                    Patient diagnosed with <b>{getDRStage(percentage)}</b>.
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