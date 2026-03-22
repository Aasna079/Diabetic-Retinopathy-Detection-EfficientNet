import React, { useState } from "react";
import "./Registerr.css";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { Link,useNavigate } from "react-router-dom";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate(); 
  const [name, setName] = useState("");
  const [nmc, setNmc] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password,
          role: "doctor",
          nmc_number: nmc,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Registered successfully! Check your email for your ID.");

        console.log("Your ID:", data.unique_id);

        navigate("/"); // go to login
      } else {
        alert(data.error);
      }

    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  return (
    <div className="register-page doctor">
      <div className="login-wrapper">
        <div className="login-container">

          <div className="left-section">
            <h1>WELCOME<span>!</span></h1>
            <p>Please enter your details to continue</p>
            <img src="/doctor.webp" alt="doctor" className="doctor-imgg" />
          </div>

          <div className="right-section">
            <h2 className="brand-title"><span>REGISTER</span></h2><br />

            <label>Name</label>
            <input
              className="input-box"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label>NMC number</label>
            <input
              className="input-box"
              placeholder="Eg:- NMC Reg. No: 56789"
              value={nmc}
              onChange={(e) => setNmc(e.target.value)}
            />

            <label>E-mail</label>
            <input
              className="input-box"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label>Password</label>
            <div className="password-box">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <div className="links">
              <p>
                Already Have an Account?{" "}
                <Link to="/Login">Login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
