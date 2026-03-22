import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./Profile.css";

const PatientProfile = () => {
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/me", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch profile");
        return res.json();
      })
      .then((data) => {
        // console.log("PROFILE DATA:", data);
        setPatient(data);
      })
      .catch((err) => {
        console.error("Error fetching profile:", err);
      });
  }, []);

  if (!patient) {
    return <div className="patient-loading">Loading patient details...</div>;
  }

  return (
    <div className="patient-page">
      <div className="patient-header">
        <p className="breadcrumb">
          Patients List / <span>Patient Details</span>
        </p>

        <div className="patient-top">
          <div className="patient-basic">
            <div>
              <h2>{patient.name}</h2>
              <p className="patient-meta">
                ID: {patient._id} • {patient.phone}
              </p>
            </div>
            <span className="status-badge">{patient.status || "Active"}</span>
          </div>
        </div>
      </div>

      <div className="patient-section">
        <h3>Personal Information</h3>
        <div className="info-grid">
          <div><span>Patient Name</span><p>{patient.name}</p></div>
          <div><span>Age</span><p>{patient.age || "N/A"}</p></div>
          <div><span>Gender</span><p>{patient.gender || "N/A"}</p></div>
          <div><span>Email</span><p>{patient.email}</p></div>
          <div><span>Phone Number</span><p>{patient.phone || "N/A"}</p></div>
          <div><span>Blood Group</span><p>{patient.bloodGroup || "N/A"}</p></div>
          <div><span>Address</span><p>{patient.address || "N/A"}</p></div>
        </div>
      </div>

      <div className="patient-section">
        <h3>Medical Information</h3>
        <div className="info-grid">
          <div><span>Condition</span><p>{patient.condition || "N/A"}</p></div>
          <div><span>Primary Physician</span><p>{patient.doctor || "N/A"}</p></div>
          <div><span>Known Allergies</span><p>{patient.allergies || "None"}</p></div>
          <div><span>Current Medication</span><p>{patient.medication || "N/A"}</p></div>
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;