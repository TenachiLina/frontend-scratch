import { Link } from "react-router-dom";
import { useState } from "react";
import King from "../assets/King.png";
import AdminLogin from "../AuthContext/AdminLogin";

export default function HeaderUser() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <>
      <header style={{ border: "none", background: "#F36224" }}>
        <div className="header-left">
          <img src={King} alt="logo" />
          <h1>Nexo InOuty</h1>
        </div>
        <nav className="navbar" style={{ background: "transparent", padding: "0" }}>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/ClockInOutUser">Clock In</Link></li>
          </ul>
        </nav>
        <button 
          onClick={() => setShowLoginModal(true)}
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
          🔐 Admin Login
        </button>
      </header>

      {showLoginModal && (
        <AdminLogin onClose={() => setShowLoginModal(false)} />
      )}
    </>
  );
}