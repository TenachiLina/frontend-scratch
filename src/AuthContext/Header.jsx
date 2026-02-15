import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext/AuthContext";
import King from "../assets/King.png";

export default function Header() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/"); // Redirect to user home
  };

  return (
    <header style={{ border: "none", background: "#F36224" }}>
      <div className="header-left">
        <img src={King} alt="logo" />
        <h1>Nexo InOuty</h1>
      </div>
      <nav className="navbar" style={{ background: "transparent", padding: "0" }}>
        <ul>
          <li><Link to="/clock-in">Clockin</Link></li>
          <li><Link to="/planning">Planning</Link></li>
          <li><Link to="/reporting">Reporting</Link></li>
          <li><Link to="/emp-management">Employees Management</Link></li>
        </ul>
      </nav>
      <button 
        onClick={handleLogout}
        style={{
          background: "#FA812F",
          border: "none",
          color: "white",
          padding: "4px 10px",
          fontSize: "13px",
          borderRadius: "5px",
          cursor: "pointer",
          fontWeight: "500",
          marginLeft: "auto",
          marginRight: "20px"
        }}
      >
        🚪 Logout
      </button>
    </header>
  );
}