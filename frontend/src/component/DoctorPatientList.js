import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";

export default function DoctorPatientList() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/me", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          return fetch(`http://localhost:5000/api/patients?doctor_id=${data.uuid}`);
        }
      })
      .then(res => res.json())
      .then(data => setPatients(data))
      .catch(err => console.error(err));
  }, []);

  const filteredPatients = patients.filter(p =>
    (p.phone || "").includes(searchTerm)
  );

  return (
    <div className="card">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by phone..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="patient-header">
        <div className="sn">S.N.</div>
        <div className="name">Name</div>
        <div className="phone">Phone no.</div>
      </div>

      <div className="patient-list">
        {filteredPatients.map((p, index) => (
          <div
            key={p.uuid}
            className="patient-row"
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/patients/${p.uuid}`, { state: { patient: p } })}
          >
            <div className="sn">{index + 1}.</div>
            <div className="name">{p.name}</div>
            <div className="phone">{p.phone}</div>
          </div>
        ))}
      </div>
    </div>
  );
}