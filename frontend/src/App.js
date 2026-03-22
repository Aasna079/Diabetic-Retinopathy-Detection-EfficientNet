import React from "react";
import './App.css';
import Login from './component/DoctorLogin';
import Register from './component/DoctorRegister';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Continue from "./component/Continue";
import DoctorDashboard from "./component/DoctorDashboard";
import Profile from "./component/Profile";
import PatientDashboard from "./component/Patientdashboard";
import PatientLogin from "./component/PatientLogin";
import PatientRegister from "./component/PatientRegister";

function App() {
  return (
    <>  
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Continue/>} />
          <Route path="/Login" element={<Login/>} />
          <Route path="/Register" element={<Register />} /> 
          <Route path="/DoctorDashboard" element={<DoctorDashboard/>} />
          <Route path="/Profile" element={<Profile/>} />   
          <Route path="/PatientDashboard" element={<PatientDashboard />} />
          <Route path="/PatientLogin" element={<PatientLogin />} />
          <Route path="/PatientRegister" element={<PatientRegister />} />
        </Routes>
      </BrowserRouter>
    </>
     );
}

export default App;
