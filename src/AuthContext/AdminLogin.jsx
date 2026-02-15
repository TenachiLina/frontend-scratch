import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function AdminLogin({ onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const success = login(password);
    
    if (success) {
      onClose();
      navigate("/clock-in"); // Redirect to Clockin page
    } else {
      setError("❌ Incorrect password");
      setPassword("");
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div 
        className="dialog-box" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
        }}
      >
        <h2 style={{ 
          marginBottom: "20px",
          background: "linear-gradient(to right, #EB4219, #F6892A)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          Admin Login
        </h2>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
              border: "2px solid #FAB12F",
              borderRadius: "8px",
              fontSize: "16px",
              boxSizing: "border-box"
            }}
          />
          
          {error && (
            <p style={{ 
              color: "#e74c3c", 
              fontSize: "14px",
              marginBottom: "10px" 
            }}>
              {error}
            </p>
          )}
          
          <div style={{ 
            display: "flex", 
            gap: "10px", 
            justifyContent: "center",
            marginTop: "20px"
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                background: "#e74c3c",
                color: "white",
                fontSize: "16px"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                background: "linear-gradient(to right, #FAB12F, #FA812F)",
                color: "white",
                fontSize: "16px"
              }}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}