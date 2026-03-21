import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Continueas.css";

export default function Continue() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-wrapper">
      <div className="login-container">

        {/* LEFT SIDE */}
        <div className="left-section">
          <h1>WELCOME<span>!</span></h1>

          {/* IMAGE */}
          <img src="/doctor.webp" alt="doctor" className="doctor-img" />
        </div>

        {/* RIGHT SIDE */}
        <div className="right-section">

          <h2 className="brand-title">
            <span>CONTINUE AS</span>
          </h2>
         
         <div className="button-row">
            <Link to="/Login"className="role-btn">Doctor</Link>
            <Link to="/Login"className="role-btn">Patient</Link>
        </div>

        </div>
      </div>
    </div>
  );
}
