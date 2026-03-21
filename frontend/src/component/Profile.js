import React, { useEffect, useState } from "react";
import "./Profile.css";

const PatientProfile = () => {
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      setPatient(JSON.parse(storedUser));
    } else {
      // Dummy patient data for frontend demo
      setPatient({
        name: "Dr.Hari Sharma",
        doctorId: "#101",
        status: "Active",
        age: 40,
        gender: "Male",
        email: "hari@example.com",
        phone: "+977 9812983989",
        bloodGroup: "O+",
        
      });
    }
  }, []);

  if (!patient) {
    return <div className="patient-loading">Loading patient details...</div>;
  }

  return (
    <div className="patient-page">
      <div className="patient-header">
        <p className="breadcrumb"><span>Your Details</span></p>

        <div className="patient-top">
          <div className="patient-basic">
            <div>
              <h2>{patient.name}</h2>
              <p className="patient-meta">
                ID: {patient.patientId} • {patient.phone}
              </p>
            </div>
            <span className="status-badge">{patient.status}</span>
          </div>
        </div>
      </div>

      <div className="patient-section">
        <h3>Personal Information</h3>
        <div className="info-grid">
          <div><span>Doctor Name</span><p>{patient.name}</p></div>
          <div><span>Age</span><p>{patient.age}</p></div>
          <div><span>Gender</span><p>{patient.gender}</p></div>
          <div><span>Email</span><p>{patient.email}</p></div>
          <div><span>Phone Number</span><p>{patient.phone}</p></div>
          
        </div>
      </div>

      <div className="patient-section">
        <h3>Medical Information of Patient</h3>
        <div className="info-grid">
          <div><span>Condition</span><p>{patient.condition}</p></div>
          <div><span>Primary Physician</span><p>{patient.doctor}</p></div>
          <div><span>Known Allergies</span><p>{patient.allergies}</p></div>
          <div><span>Current Medication</span><p>{patient.medication}</p></div>
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;