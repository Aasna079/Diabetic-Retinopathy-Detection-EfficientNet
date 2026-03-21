import React from "react";
import './App.css';
import Login from './component/DoctorLogin';
import Register from './component/DoctorRegister';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ContinueAs from "./component/Continue";
import Continue from "./component/Continue";
import DoctorDashboard from "./component/Dashboard";
import Profile from "./component/Profile";
import PatientDashboard from "./component/Patientdashboard";

function App() {
  return (
    <>  
      <BrowserRouter>
        <Routes>
           <Route path="/DoctorDashboard" element={<DoctorDashboard/>} />
          <Route path="/" element={<ContinueAs/>} />
          <Route path="/" element={<Continue/>} />
          <Route path="/Login" element={<Login/>} />
          <Route path="/Register" element={<Register />} />
          <Route path="/" element={<PatientDashboard/>} />       
          <Route path="/register"element={<Register />}/>
          <Route path="/DoctorLogin" element={<Login />} />
      
        </Routes>
      </BrowserRouter>
    </>
     );
}

export default App;
