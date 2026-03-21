import React, { useState } from "react";
import "./Registerr.css";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate(); 

  const handleSubmit = () => {
    // TEMPORARY CHECK (replace with real logic later)
    setError(false);
    navigate("/DoctorDashboard"); 
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">

        <div className="left-section">
          <h1>WELCOME<span>!</span></h1>
          <p>Please enter your details to continue</p>
          <img src="/doctor.webp" alt="doctor" className="doctor-imgg" />
        </div>

        <div className="right-section">
          <h2 className="brand-title"><span>REGISTER</span></h2>

          <label>Name</label>
          <input type="text" className="input-box" />

          <label>ID</label>
          <input type="text" placeholder="Eg:- 208965" className="input-box" />

          <label>Username or E-mail</label>
          <input type="text" className="input-box" />

          <label>Password</label>
          <div className="password-box">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="********"
            />

            <span
              className="toggle-eye"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
            </span>
          </div>

          {error && (
            <p className="error-msg">The username or password is incorrect</p>
          )}

          
          <button className="login-btn" onClick={handleSubmit}>
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
