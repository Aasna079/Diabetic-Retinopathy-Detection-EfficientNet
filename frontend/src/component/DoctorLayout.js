import { useNavigate } from "react-router-dom";

export default function DoctorLayout({ children }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="dashboard">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <img src="/ICON NAME.png" alt="icon" className="sidebar-icon" />
          <div className="sidebar-text">
            <span className="sidebar-main">Diabetic</span>
            <span className="sidebar-sub">Retinopathy</span>
          </div>
        </div>

        <nav>
          <div onClick={() => navigate("/DoctorDashboard")}>
            <img src="/dashboard.png" className="menu-icon" />
            Dashboard
          </div>

          <div onClick={() => navigate("/patients")}>
            <img src="/pat.png" className="menu-icon" />
            My Patients
          </div>

          <div onClick={() => navigate("/Profile")}>
            <img src="/patient.png" className="menu-icon" />
            Profile
          </div>
        </nav>

        <div className="logout-btn" onClick={handleLogout}>
          <img src="/logout.png" className="sidebar-icon1" />
          Logout
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        {children}
      </main>
    </div>
  );
}