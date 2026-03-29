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
import MapPage from './component/Map';
import SetPassword from "./component/SetPassword";
import DoctorPatientList from "./component/DoctorPatientList";
import DoctorLayout from "./component/DoctorLayout";
import DoctorPatientDetails from "./component/DoctorPatientDetails";

function App() {
  return (
    <>  
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Continue/>} />
          <Route path="/Login" element={<Login/>} />
          <Route path="/Register" element={<Register />} /> 
          <Route
            path="/patients/:id"
            element={
              <ProtectedRoute allowedRole="doctor">
                <DoctorLayout>
                  <DoctorPatientDetails /> {/* New component */}
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/Profile"
            element={
              <ProtectedRoute allowedRole="doctor">
                <DoctorLayout>
                  <Profile />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />  
          <Route path="/PatientLogin" element={<PatientLogin />} />
          <Route path="/PatientRegister" element={<PatientRegister />} />
          <Route
            path="/patients"
            element={
              <ProtectedRoute allowedRole="doctor">
                <DoctorLayout>
                  <DoctorPatientList />
                </DoctorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/DoctorDashboard"
            element={
              <ProtectedRoute allowedRole="doctor">
                <DoctorLayout>
                  <DoctorDashboard />
                </DoctorLayout>
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
          <Route path="/Map" element={<MapPage />} />
          <Route path="/set-password" element={<SetPassword />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
export default App;