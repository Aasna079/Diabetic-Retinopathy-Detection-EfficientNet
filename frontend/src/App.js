import React from "react";
import './App.css';
import Login from './component/DoctorLogin';
import Register from './component/DoctorRegister';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Continue from "./component/Continue";
import DoctorDashboard from "./component/DoctorDashboard";
import Profile from "./component/Profile";
import PatientDashboard from "./component/PatientDashboard";
import PatientLogin from "./component/PatientLogin";
import PatientRegister from "./component/PatientRegister";
import ProtectedRoute from "./component/ProtectedRoute";

function App() {
  return (
    <>  
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Continue/>} />
          <Route path="/Login" element={<Login/>} />
          <Route path="/Register" element={<Register />} /> 
          <Route path="/Profile" element={<Profile/>} />   
          <Route path="/PatientLogin" element={<PatientLogin />} />
          <Route path="/PatientRegister" element={<PatientRegister />} />
          <Route path="/DoctorDashboard"
              element={
                <ProtectedRoute allowedRole="doctor">
                  <DoctorDashboard />  /* Doctor route */
                </ProtectedRoute>
              }
          /> 
          <Route path="/PatientDashboard"
              element={
                <ProtectedRoute allowedRole="patient">
                  <PatientDashboard />   /* Patient route */
                </ProtectedRoute>
              }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
