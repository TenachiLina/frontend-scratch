import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './App.css';
import { AuthProvider } from "./AuthContext/AuthContext";
import ProtectedRoute from "./AuthContext/ProtectedRoute";

// User Pages (Public)
import Home from "./Pages/Home";
import ClockInOutUser from "./Pages/Clock-inPageUser";

// Admin Pages (Protected)
import ClockInOut from "./Pages/Clock-inPage";
import Planning from "./Pages/PlanningPage";
import Reporting from "./Pages/Reporting";
import Emp_Management from "./Pages/Emp_Management";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* PUBLIC ROUTES - User View */}
          <Route path="/" element={<Home />} />
          <Route path="/ClockInOutUser" element={<ClockInOutUser />} />

          {/* PROTECTED ROUTES - Admin View */}
          <Route 
            path="/emp-management" 
            element={
              <ProtectedRoute>
                <Emp_Management />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/clock-in" 
            element={
              <ProtectedRoute>
                <ClockInOut />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/planning" 
            element={
              <ProtectedRoute>
                <Planning />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reporting" 
            element={
              <ProtectedRoute>
                <Reporting />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;