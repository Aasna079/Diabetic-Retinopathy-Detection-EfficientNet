import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function SetPassword() {
  const navigate = useNavigate();
  const query = new URLSearchParams(useLocation().search);
  const token = query.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/patient/set_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Password set successfully!");
        navigate("/PatientLogin");
      } else {
        alert(data.error || "Failed to set password");
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  return (
    <div>
      <h2>Set Your Password</h2>
      <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      <button onClick={handleSubmit}>Set Password</button>
    </div>
  );
}