import React, { useState, useEffect } from "react";
import "./DoctorDashboard.css";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";


export default function DoctorDashboard() {
  const [percentage, setPercentage] = useState(0);
  const [fileName, setFileName] = useState("");
  const [doctor, setDoctor] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPatientForDiagnosis, setSelectedPatientForDiagnosis] = useState(null);
  const navigate = useNavigate();
  const [patient, setPatient] = useState({
    name: "",
    email: "",
    date: "",
    id: ""
  });
  
  const location = useLocation();

  useEffect(() => {
    if (location.state?.patient) {
      setSelectedPatientForDiagnosis(location.state.patient);
    }
  }, [location.state]);

  /* ---------------- LOAD USER + CASES ---------------- */
  useEffect(() => {
    // Load doctor info
    fetch("http://localhost:5000/api/me", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setDoctor(data);
        }
      })
      .catch(err => console.error("Error loading user:", err));
      
  }, []);
 
  useEffect(() => {
    if (selectedPatientForDiagnosis) {
      setPatient({
        name: selectedPatientForDiagnosis.name,
        email: selectedPatientForDiagnosis.email,
        date: new Date().toISOString().split("T")[0],
        id: selectedPatientForDiagnosis.uuid
      });
    }
  }, [selectedPatientForDiagnosis]);


  /* ---------------- FILE UPLOAD ---------------- */
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setAiResult(null);

    try {
      if (!doctor) {
        alert("Doctor not loaded yet. Please wait.");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('doctor_id', doctor.uuid || doctor._id || doctor.id);

      if (selectedPatientForDiagnosis) {
        formData.append('patient_id', selectedPatientForDiagnosis.uuid || selectedPatientForDiagnosis._id);
        formData.append('patient_name', selectedPatientForDiagnosis.name);
        formData.append('patient_email', selectedPatientForDiagnosis.email);
      } else {
        formData.append('patient_id', "demo_patient"); // fallback
      }

      formData.append('image', file);

      const response = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setAiResult(result);

      // Save report locally if patient selected
      if (selectedPatientForDiagnosis) {
        const newReport = {
          ...result,
          date: new Date().toISOString(),
          prediction_id: result.prediction_id || `${Date.now()}-${Math.random()}`,
        };
        localStorage.setItem("patientReport", JSON.stringify(newReport));
      }

      setPercentage((result?.confidence || 0 * 100).toFixed(2));

      setPatient({
        name: selectedPatientForDiagnosis?.name || "",
        email: selectedPatientForDiagnosis?.email || "",
        date: new Date().toISOString().split("T")[0],
        id: selectedPatientForDiagnosis?.uuid || "",
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      alert('AI Analysis failed. Make sure backend is running (python app.py)\nError: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Logout Function
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
      {/* ================= MAIN ================= */}
      <main className="main">
        {/* Welcome Doctor */}
        {doctor && <h2 className="welcome-text">Welcome Dr. {doctor?.name}</h2>}

        {/* ---------- DASHBOARD ---------- */}
        <>
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
                  <br />
                  {/* ── 1. class_id ── */}
                  <p><strong>Class_id:</strong> {fmt(aiResult.class_id)}</p>

                  {/* ── 2. class_name ── */}
                  <p><strong>Class_name:</strong> {fmt(aiResult.class_name)}</p>

                  {/* ── 3. confidence ── */}
                  <p>
                    <strong>Confidence:</strong>{" "}
                    {aiResult.confidence !== undefined && aiResult.confidence !== null
                      ? aiResult.confidence
                      : "N/A"}
                  </p>

                  {/* ── 4. doctor_id ── */}
                  <p><strong>Doctor_id:</strong> {fmt(aiResult.doctor_id)}</p>

                  {/* ── 5. filename ── */}
                  <p><strong>Filename:</strong> {fmt(aiResult.filename)}</p>

                  <hr />

                  {/* ── 6. model_metrics ── */}
                  <div>
                    <strong>Model_Metrics:</strong>
                    {aiResult.model_metrics && Object.keys(aiResult.model_metrics).length > 0 ? (
                      <div style={{ paddingLeft: "16px" }}>
                        <p className="probpre"><div className="pre">F1_score: </div>{fmt(aiResult.model_metrics.f1_score)}</p>
                        <p className="probpre"><div className="pre">Precision: </div>{fmt(aiResult.model_metrics.precision)}</p>
                        <p className="probpre"><div className="pre">Recall: </div>{fmt(aiResult.model_metrics.recall)}</p>
                        <p className="probpre"><div className="pre">Support: </div>{fmt(aiResult.model_metrics.support)}</p>
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
                  <p><strong>Patient_id:</strong> {fmt(aiResult.patient_id)}</p>

                  {/* ── 10. prediction_id ── */}
                  <p><strong>Prediction_id:</strong> {fmt(aiResult.prediction_id)}</p>

                  <hr />

                  {/* ── 11. probabilities ── */}
                  <div>
                    <strong>Probabilities:</strong>
                    {aiResult.probabilities && Object.keys(aiResult.probabilities).length > 0 ? (
                      <div style={{ paddingLeft: "16px" }}>
                        {(() => {
                          const sortedProbs = Object.entries(aiResult.probabilities)
                            .sort((a, b) => a[1] - b[1]); // ascending (lowest → highest)

                          const maxKey = sortedProbs[sortedProbs.length - 1]?.[0]; // LAST = highest

                          return sortedProbs.map(([key, value]) => (
                            <p
                              key={key}
                              className={`probpre ${key === maxKey ? "highlighted-p" : ""}`}
                            >
                              <span className="pre">{key}:</span> <span className="prep">{value}</span>
                            </p>
                          ));
                        })()}
                      </div>
                    ) : <span>N/A</span>}
                  </div>

                  <hr />

                  {/* ── 12. recommendation ── */}
                  <div className="reso"><strong className="reso1">Recommendation:</strong>
                  <div className="reso2">{fmt(aiResult.recommendation)}</div></div>

                </div>
              )}
            </div>
          </>
        </>
      </main>
    </div>
  );
}