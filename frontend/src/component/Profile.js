import React, { useEffect, useState } from "react";
import "./Profile.css";

const Profile = () => {
  const [doctor, setDoctor] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/me", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch profile");
        return res.json();
      })
      .then((data) => {
        setDoctor(data);
      })
      .catch((err) => {
        console.error("Error fetching profile:", err);
      });
  }, []);

  if (!doctor) {
    return <div className="patient-loading">Loading profile...</div>;
  }

  return (
    <div className="patient-page">
      <div className="patient-header">
        <p className="breadcrumb">
          <span>Your Details</span>
        </p>

        <div className="patient-top">
          <div className="patient-basic">
            <div>
              <h2>{doctor.name || "N/A"}</h2>
              <p className="patient-meta">
                ID: {doctor.doctorId || doctor.id || "N/A"} •{" "}
                {doctor.phone || "N/A"}
              </p>
            </div>
            <span className="status-badge">
              {doctor.status || "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* PERSONAL INFORMATION ONLY */}
      <div className="patient-section">
        <h3>Personal Information</h3>

        <div className="info-grid">
          <div>
            <span>Name</span>
            <p>{doctor.name || "N/A"}</p>
          </div>

          <div>
            <span>Age</span>
            <p>{doctor.age || "N/A"}</p>
          </div>

          <div>
            <span>Gender</span>
            <p>{doctor.gender || "N/A"}</p>
          </div>

          <div>
            <span>Email</span>
            <p>{doctor.email || "N/A"}</p>
          </div>

          <div>
            <span>Phone Number</span>
            <p>{doctor.phone || "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;