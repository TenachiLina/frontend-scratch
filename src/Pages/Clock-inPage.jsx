import '../App.css'
import Header from "../Components/Header"
import Content from "../Components/Content"
import TextField from "../Components/TextField"
import { useState, useEffect } from "react";
import { employeesApi } from "../services/employeesAPI";
import { worktimeApi } from "../services/worktimeAPI";
import { API_BASE_URL } from "../services/config";
import { useNavigate } from "react-router-dom";

// Function to calculate work hours, late minutes, and overtime
function calculateWorkTime(shiftStart, shiftEnd, clockIn, clockOut) {
  const toMinutes = time => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const shiftStartM = toMinutes(shiftStart);
  const shiftEndM = toMinutes(shiftEnd);
  const clockInM = toMinutes(clockIn);
  const clockOutM = toMinutes(clockOut);

  const lateMinutes = Math.max(0, clockInM - shiftStartM);
  const workedMinutes = clockOutM - clockInM;
  const shiftMinutes = shiftEndM - shiftStartM;
  const overtimeMinutes = Math.max(0, workedMinutes - shiftMinutes);
  const workHours = Math.floor(workedMinutes / 60);

  return { workHours, lateMinutes, overtimeMinutes };
}

function ClockInPage() {
  // PASSWORD PROTECTION - Change this password to whatever you want
  const CORRECT_PASSWORD = "admin123"; // ⬅️ CHANGE THIS TO YOUR DESIRED PASSWORD
  
  // Check localStorage for existing authentication on component mount
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('clockInPageAuth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordError, setShowPasswordError] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [plannedShift, setPlannedShift] = useState(null); 
  const [selectedShifts, setSelectedShifts] = useState({});

 

  // Handle password submission
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('clockInPageAuth', 'true'); // Save to localStorage
      setShowPasswordError(false);
    } else {
      setShowPasswordError(true);
      setPasswordInput("");

    }
  };

  // If not authenticated, show password form
  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h2 style={{
            textAlign: 'center',
            marginBottom: '30px',
            color: '#333'
          }}>
            🔒 Enter Password
          </h2>
          
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: showPasswordError ? '2px solid #dc3545' : '2px solid #ddd',
                borderRadius: '5px',
                marginBottom: '15px',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
            
            {showPasswordError && (
              <p style={{
                color: '#dc3545',
                marginBottom: '15px',
                fontSize: '14px'
              }}>
                ❌ Incorrect password. Please try again.
              </p>
            )}
            
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    );
  }



  return <AuthenticatedContent 
    employees={employees}
    setEmployees={setEmployees}
    loading={loading}
    setLoading={setLoading}
    error={error}
    setError={setError}
    currentDate={currentDate}
    setCurrentDate={setCurrentDate}
    plannedShift={plannedShift}
    setPlannedShift={setPlannedShift}
    selectedShifts={selectedShifts}
    setSelectedShifts={setSelectedShifts}
  />;
}

// Separate component for the authenticated content
function AuthenticatedContent({ 
  employees, 
  setEmployees,
  loading,
  setLoading,
  error,
  setError,
  currentDate,
  setCurrentDate,
  plannedShift,
  setPlannedShift,
  selectedShifts,
  setSelectedShifts
}) {
  const navigate = useNavigate(); // Add this line

  useEffect(() => {
    const loadShifts = async () => {
      if (!currentDate) return;

      try {
        const updatedShifts = await employees.reduce(async (accPromise, emp) => {
          const acc = await accPromise;

          const res = await fetch(`${API_BASE_URL}/api/planning/employee-shifts-all/${emp.num}/${currentDate}`); 
          if (!res.ok) return acc;
          
          const data = await res.json(); 
          
          const shiftIds = data
            .map(shift => shift.shift_id ? shift.shift_id.toString() : null)
            .filter(id => id !== null);

          acc[emp.num] = shiftIds;

          return acc;
        }, Promise.resolve({}));

        setSelectedShifts(updatedShifts); 
      } catch (err) {
        console.error("Error fetching shifts:", err);
        setSelectedShifts({});
      }
    };

    loadShifts();
  }, [currentDate, employees]);

  // GET CURRENT DATE (local time)
  useEffect(() => {
    const updateDate = () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setCurrentDate(`${yyyy}-${mm}-${dd}`);
    };

    updateDate();
    const timer = setInterval(updateDate, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // FETCH EMPLOYEES
  useEffect(() => {
    if (!currentDate) return;

    const cacheKey = `employees_${currentDate}`;

    const fetchEmployees = async () => {
      
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        console.log("🫣🫣🫣🫣 It uses the cache.");
        setEmployees(JSON.parse(cached));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const employeesData = await employeesApi.getEmployees();
        console.log("🏃👷👷👷👷👷👷Employees fetched: ",employeesData);
        const transformedEmployees = employeesData.map(emp => ({
          empNumber: emp.emp_number,
          num: emp.emp_id,
          FirstName: emp.FirstName,  // ✅ Ajouté
          LastName: emp.LastName,    // ✅ Ajouté
          clockIn: "00:00",
          clockOut: "00:00",
          shift: 0,
        }));
        console.log("🏃👷👷👷👷👷👷Employees fetched: ",transformedEmployees);
        const employeesWithShifts = await Promise.all(
          transformedEmployees.map(async emp => {
            try {
              const res = await fetch(
                `${API_BASE_URL}/api/planning/employee-shift/${emp.num}/${currentDate}`
              );
              if (!res.ok) return { ...emp, shift: 0 };
              const data = await res.json();
              return { ...emp, shift: data.shift_id || 0 };
            } catch {
              return { ...emp, shift: 0 };
            }
          })
        );

        setEmployees(employeesWithShifts);
        localStorage.setItem(cacheKey, JSON.stringify(employeesWithShifts));
        setError(null);

      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Failed to load employees');
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [currentDate]);

  // FETCH PLANNED SHIFTS
  const fetchAllPlannedShifts = async (employeesList) => {
    const today = currentDate || new Date().toISOString().split('T')[0];
    const updated = await Promise.all(
      employeesList.map(async (emp) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/planning/employee-shift/${emp.num}/${today}`);
          if (!res.ok) throw new Error("No planned shift");
          const data = await res.json();
          return {
            ...emp,
            shift: data.shift_id,
            shiftStart: data.start_time,
            shiftEnd: data.end_time,
          };
        } catch {
          return emp;
        }
      })
    );
    setEmployees(updated);
  };

  // ADD NEW EMPLOYEE
  const addNewEmployee = async () => {
    const name = prompt("Enter new employee name:");
    if (!name) return;
    try {
      const newEmployee = await employeesApi.addEmployee({ name });
      setEmployees(prev => [
        ...prev,
        {
          num: newEmployee.id,
          name: name,
          clockIn: "00:00",
          clockOut: "00:00",
          shift: 0,
          delay: "00:00",
          overtime: "00:00",
          hours: "00:00"
        }
      ]);
      alert(`Employee "${name}" added successfully!`);
    } catch (err) {
      alert('Error adding employee: ' + err.message);
    }
  };

  // DELETE EMPLOYEE
  const handleEmployeeDeleted = async (employeeId) => {
    try {
      await employeesApi.deleteEmployee(employeeId);
      setEmployees(prev => prev.filter(emp => emp.num !== employeeId));
      alert("Employee deleted successfully!");
    } catch (err) {
      alert('Error deleting employee: ' + err.message);
    }
  };

  // CLOCK IN
  const handleClockIn = () => {
    const now = new Date().toISOString();
    localStorage.setItem("clockInTime", now);
    alert(`Clocked in at ${new Date(now).toLocaleTimeString()}`);
  };

  // CLOCK OUT
  const handleClockOut = () => {
    const clockInTime = localStorage.getItem("clockInTime");
    if (!clockInTime) {
      alert("You must clock in first!");
      return;
    }

    const clockOutTime = new Date().toISOString();
    const employeeId = prompt("Enter your Employee ID:");
    if (!employeeId) return alert("Employee ID is required");

    const clockInHHMM = clockInTime.split('T')[1].substring(0, 5);
    const clockOutHHMM = clockOutTime.split('T')[1].substring(0, 5);

    const { workHours, lateMinutes, overtimeMinutes } = calculateWorkTime(
      "08:00",
      "16:00",
      clockInHHMM,
      clockOutHHMM
    );

    worktimeApi.saveWorkTime({
      employeeId: parseInt(employeeId),
      date: currentDate,
      timeOfWork: workHours.toString(),
      delay: lateMinutes.toString(),
      overtime: overtimeMinutes.toString(),
      shift: 1,
      absent: false,
      absentComment: ""
    })
      .then(() => {
        alert("✅ Worktime recorded successfully!");
        localStorage.removeItem("clockInTime");
      })
      .catch(err => {
        console.error('Worktime save error:', err);
        alert("❌ Error saving work time to database");
      });
  };

  // SAVE ALL
  const saveAll = () => {
    alert('Save functionality would go here');
  };

  if (loading) return <div>Loading employees...</div>;
  if (error) return <div>Error: {error}</div>;

  // Logout function
 const handleLogout = () => {
  if (window.confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('clockInPageAuth');
    navigate('/ClockInOutUser'); // Redirect to user page
  }
};

  return (
    <>
      <Header />
      <TextField label="Date" value={currentDate} readOnly />
      <Content
        employees={employees}
        selectedShifts={selectedShifts}
        setSelectedShifts={setSelectedShifts}
        onEmployeeDeleted={handleEmployeeDeleted} 
      />
      <div className='cntbtns'>
        <button 
          className='cntbtn' 
          onClick={handleLogout}
          style={{ backgroundColor: '#dc3545' }}
        >
          Logout
        </button>
      </div>
    </>
  );
}

export default ClockInPage;