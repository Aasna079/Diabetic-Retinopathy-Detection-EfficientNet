import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./ContinueAs.css";


export default function Continue() {
  /*const [showPassword, setShowPassword] = useState(false);*/

  return (
    <div className="login-wrapper">
      <div className="login-container">

        {/* LEFT SIDE */}
        <div className="left-section">
          <h1>WELCOME<span>!</span></h1>
          {/* added after doctor login was modified */}
          <div className="sidebar-text">
            <span className="sidebar-main">Diabetic</span>
            <span className="sidebar-sub"> Retinal Neuropathy</span>
          </div>
          {/* till here */}

          {/* IMAGE */}
          <img src="/doctor.webp" alt="doctor" className="doctor-img" />
        </div>

        {/* RIGHT SIDE */}
        <div className="right-section">

          <h2 className="brand-title">
            <span>CONTINUE AS</span>
          </h2>
         
         <div className="role-container">
            <Link to="/Login" className="role-btn">
              <img src="/dr.png" alt="doctor" className="sidebar-icon1" />Doctor
            </Link>

            <Link to="/Login" className="role-btn">
              <img src="/patient.png" alt="doctor" className="sidebar-icon1" />Patient
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
