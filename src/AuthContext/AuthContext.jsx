import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

// Hardcoded password
const ADMIN_PASSWORD = "admin123";

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user was previously logged in (persists across page refreshes)
  useEffect(() => {
    const adminStatus = sessionStorage.getItem("isAdmin");
    if (adminStatus === "true") {
      setIsAdmin(true);
    }
  }, []);

  const login = (password) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      sessionStorage.setItem("isAdmin", "true");
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem("isAdmin");
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}