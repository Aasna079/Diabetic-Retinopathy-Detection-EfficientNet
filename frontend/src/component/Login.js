import React, { useState } from "react";
import "./Login.css";
import { Link, useNavigate } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate(); 

  const handleLogin = () => {
    navigate("/DoctorDashboard"); 
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">

        {/* LEFT SIDE */}
        <div className="left-section">
          <h1>
            WELCOME<span>!</span>
          </h1>
          <p>Please enter your details to continue</p>

          <img
            src="/doctor.webp"
            alt="doctor"
            className="doctor-img-login"
          />
        </div>

        {/* RIGHT SIDE */}
        <div className="right-section">
          <h2 className="brand-title">
            <span>LOGIN</span>
          </h2>

          <label>ID</label>
          <input
            type="text"
            placeholder="Eg:-208965"
            className="input-box"
          />

          <label>Username or E-mail</label>
          <input type="text" className="input-box" />

          <label>Password</label>
          <div className="password-box">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="********"
              className="input-box"
            />

            <span
              className="toggle-eye"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
            </span>
          </div>

      
          <button className="login-btn" onClick={handleLogin}>
            Log in
          </button>

          <div className="links">
            <p>
              Do Not Have Account?{" "}
              <Link to="/Register">Sign Up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
