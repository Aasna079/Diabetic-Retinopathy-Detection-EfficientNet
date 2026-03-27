import React, { useState } from "react";
import "./Login.css";
import { Link, useNavigate } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate(); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        if (!data.user || !data.user.role) {
          alert("Invalid server response");
          return;
        }
        navigate("/DoctorDashboard");
      } else {
        if (response.status === 404) {
          alert("User not found. Check your email.");
        } else if (response.status === 401) {
          alert("Incorrect password.");
        } else {
          alert(data.error);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Server error");
    }
  };

  return (
    <div className="login-page doctor">
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
            </h2><br />

            <label>E-mail</label>
            <input
              type="text"
              className="input-box"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label>Password</label>
            <div className="password-box">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="********"
                className="input-box"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
    </div>
  );
}
