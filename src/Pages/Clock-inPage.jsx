import '../App.css'
import Header from "../AuthContext/Header"
import Content from "../Components/Content"
import TextField from "../Components/TextField"
import { useState, useEffect } from "react";
import { employeesApi } from "../services/employeesAPI";
import { worktimeApi } from "../services/worktimeAPI";
import { shiftApi } from "../services/shfitAPI";
import { planningApi } from "../services/planningAPI";
import { API_BASE_URL } from "../services/config";
import { useNavigate } from "react-router-dom";
import { loadAllWorktimeForDate, clearEmployeeCache } from "../services/worktimeSync";

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
  const navigate = useNavigate();
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [plannedShift, setPlannedShift] = useState(null);
  const [selectedShifts, setSelectedShifts] = useState({});
  const [selectedShiftsForDate, setSelectedShiftsForDate] = useState([]);

  // GET CURRENT DATE (local time)
  useEffect(() => {
    const updateDate = () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setCurrentDate(`${yyyy}-${mm}-${dd}`);
    };

    updateDate(); // set immediately
    const timer = setInterval(updateDate, 60 * 1000); // update every minute

    return () => clearInterval(timer); // cleanup on unmount
  }, []);

  // FETCH EMPLOYEES WITH CACHING AND WORKTIME DATA
  useEffect(() => {
    if (!currentDate) return;

    const cacheKey = `employees_${currentDate}`;

    const fetchEmployees = async () => {
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          
          // IMPORTANT: Merge with latest localStorage worktime data
          const localStorageTimes = loadAllWorktimeForDate(currentDate);
          console.log('🔄 Manager view: Loading localStorage times', localStorageTimes);
          
          const mergedEmployees = parsedCache.map(emp => {
            const key = `${emp.num}-${emp.shift}`;
            if (localStorageTimes[key]) {
              return {
                ...emp,
                clockIn: localStorageTimes[key].clockIn,
                clockOut: localStorageTimes[key].clockOut,
                absent: localStorageTimes[key].absent || false,
                absentComment: localStorageTimes[key].absentComment || ""
              };
            }
            return emp;
          });
          
          setEmployees(mergedEmployees);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Cache parse error:', e);
          localStorage.removeItem(cacheKey);
        }
      }

      setLoading(true);
      try {
        const employeesData = await employeesApi.getEmployees();

        const transformedEmployees = employeesData.map(emp => ({
          num: emp.emp_id,
          FirstName: emp.FirstName || emp.name || 'Unknown',
          LastName: emp.LastName || '',
          empNumber: emp.emp_number || emp.emp_id,
          clockIn: "00:00",
          clockOut: "00:00",
          shift: 0,
        }));

        // Fetch shift assignments from planning
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

        // Load worktime from localStorage FIRST (for sync)
        const localStorageTimes = loadAllWorktimeForDate(currentDate);
        console.log('📦 Manager view: Loaded from localStorage', localStorageTimes);

        // Merge localStorage times with employee data
        const employeesWithWorktime = employeesWithShifts.map(emp => {
          const key = `${emp.num}-${emp.shift}`;
          if (localStorageTimes[key]) {
            return {
              ...emp,
              clockIn: localStorageTimes[key].clockIn,
              clockOut: localStorageTimes[key].clockOut,
              absent: localStorageTimes[key].absent || false,
              absentComment: localStorageTimes[key].absentComment || ""
            };
          }
          return emp;
        });

        setEmployees(employeesWithWorktime);
        localStorage.setItem(cacheKey, JSON.stringify(employeesWithWorktime));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();

    // Check for updates to employees (additions/deletions)
    const checkForUpdates = () => {
      const updateFlag = localStorage.getItem("employees_updated");
      if (updateFlag) {
        console.log("🔄 Detected employee changes, refreshing cache...");
        localStorage.removeItem(cacheKey);
        localStorage.removeItem("employees_updated");
        fetchEmployees();
      }
    };

    const updateInterval = setInterval(checkForUpdates, 2000);

    // Listen for storage changes (across tabs/windows)
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('worktime_') && e.key.includes(currentDate)) {
        console.log('📦 MANAGER VIEW: Storage changed, updating employees');
        const localStorageTimes = loadAllWorktimeForDate(currentDate);
        setEmployees(prev => {
          return prev.map(emp => {
            const key = `${emp.num}-${emp.shift}`;
            if (localStorageTimes[key]) {
              return {
                ...emp,
                clockIn: localStorageTimes[key].clockIn,
                clockOut: localStorageTimes[key].clockOut
              };
            }
            return emp;
          });
        });
      }
    };

    // Listen for custom events from same browser (same-tab sync)
    const handleWorktimeUpdate = (e) => {
      console.log('🎧 MANAGER VIEW: Custom event fired', e.detail);
      console.log('🔥 MANAGER VIEW: Worktime updated, updating state smoothly...');
      // Just update the clock times, don't reload everything
      const localStorageTimes = loadAllWorktimeForDate(currentDate);
      setEmployees(prev => {
        console.log('🔄 MANAGER VIEW: Updating employees with times', localStorageTimes);
        return prev.map(emp => {
          const key = `${emp.num}-${emp.shift}`;
          if (localStorageTimes[key]) {
            console.log(`   ✅ Updating employee ${emp.num} shift ${emp.shift}`, localStorageTimes[key]);
            return {
              ...emp,
              clockIn: localStorageTimes[key].clockIn,
              clockOut: localStorageTimes[key].clockOut
            };
          }
          return emp;
        });
      });
    };

    // Listen for simple event too
    const handleWorktimeChanged = (e) => {
      console.log('🎧 MANAGER VIEW: Simple worktime-changed event fired');
      const localStorageTimes = loadAllWorktimeForDate(currentDate);
      setEmployees(prev => prev.map(emp => {
        const key = `${emp.num}-${emp.shift}`;
        if (localStorageTimes[key]) {
          return {
            ...emp,
            clockIn: localStorageTimes[key].clockIn,
            clockOut: localStorageTimes[key].clockOut
          };
        }
        return emp;
      }));
    };

    console.log('👂 MANAGER VIEW: Adding event listeners');
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('worktimeUpdated', handleWorktimeUpdate);
    window.addEventListener('worktime-changed', handleWorktimeChanged);

    return () => {
      console.log('🔇 MANAGER VIEW: Removing event listeners');
      clearInterval(updateInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('worktimeUpdated', handleWorktimeUpdate);
      window.removeEventListener('worktime-changed', handleWorktimeChanged);
    };
  }, [currentDate]);

  // LOAD SELECTED SHIFTS FOR CURRENT DATE FROM PLANNING
  useEffect(() => {
    const loadSelectedShiftsForDate = async () => {
      if (!currentDate) return;

      try {
        const planningData = await planningApi.getPlanning(currentDate);
        
        // Extract unique shift IDs from planning
        const usedShiftIds = new Set();
        planningData.forEach(assignment => {
          if (assignment.shift_id) {
            usedShiftIds.add(assignment.shift_id);
          }
        });

        // Fetch all shifts to get their details
        const allShifts = await shiftApi.getShifts();
        
        // Filter and sort shifts that are used in planning
        const shiftsForDate = allShifts
          .filter(shift => usedShiftIds.has(shift.shift_id))
          .sort((a, b) => {
            const timeToMinutes = (time) => {
              const [h, m] = time.split(":").map(Number);
              return h * 60 + m;
            };
            return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
          });

        setSelectedShiftsForDate(shiftsForDate);
      } catch (err) {
        console.error("Error loading shifts for date:", err);
        setSelectedShiftsForDate([]);
      }
    };

    loadSelectedShiftsForDate();
  }, [currentDate]);

  // LOAD ALL SHIFTS FOR EACH EMPLOYEE
  useEffect(() => {
    const loadShifts = async () => {
      if (!currentDate || employees.length === 0) return;

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
          FirstName: name,
          LastName: '',
          empNumber: newEmployee.id,
          clockIn: "00:00",
          clockOut: "00:00",
          shift: 0,
          delay: "00:00",
          overtime: "00:00",
          hours: "00:00"
        }
      ]);
      alert(`Employee "${name}" added successfully!`);
      
      // Clear cache when new employee is added
      const cacheKey = `employees_${currentDate}`;
      localStorage.removeItem(cacheKey);
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
      
      // Clear cache when employee is deleted
      const cacheKey = `employees_${currentDate}`;
      localStorage.removeItem(cacheKey);
    } catch (err) {
      alert('Error deleting employee: ' + err.message);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh"
        }}>
          <div>Loading employees...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh"
        }}>
          <div>Error: {error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <TextField label="Date" value={currentDate} readOnly />

      <Content
        employees={employees}
        selectedShifts={selectedShifts}
        selectedShiftsForDate={selectedShiftsForDate}
        setSelectedShifts={setSelectedShifts}
        onEmployeeDeleted={handleEmployeeDeleted}
        currentDate={currentDate} 
      />
    </>
  );
} 

export default ClockInPage;