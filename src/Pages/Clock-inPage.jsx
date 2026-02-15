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

  // FETCH EMPLOYEES WITH CACHING AND WORKTIME DATA - FIXED FOR MULTIPLE TASKS
  useEffect(() => {
    if (!currentDate) return;

    const fetchEmployees = async () => {
      setLoading(true);
      try {
        // Get planning data first
        const planningData = await planningApi.getPlanning(currentDate);
        
        console.log('📋 Planning data:', planningData);

        if (planningData.length === 0) {
          setEmployees([]);
          setLoading(false);
          return;
        }

        // Get all employees
        const employeesData = await employeesApi.getEmployees();

        // Create employee map for quick lookup
        const employeeMap = {};
        employeesData.forEach(emp => {
          employeeMap[emp.emp_id] = {
            num: emp.emp_id,
            FirstName: emp.FirstName || emp.name || 'Unknown',
            LastName: emp.LastName || '',
            empNumber: emp.emp_number || emp.emp_id,
          };
        });

        // ✅ Group planning by emp_id and shift_id (ignore multiple tasks)
        // Use Map to deduplicate by emp_id-shift_id combination
        const uniquePlanningMap = new Map();
        
        planningData.forEach(plan => {
          const key = `${plan.emp_id}-${plan.shift_id}`;
          
          // Only add if not already in map, or if this entry has custom times
          const existing = uniquePlanningMap.get(key);
          if (!existing) {
            uniquePlanningMap.set(key, plan);
          } else if (plan.custom_start_time || plan.custom_end_time) {
            // Prefer entries with custom times
            uniquePlanningMap.set(key, plan);
          }
        });

        const uniquePlanning = Array.from(uniquePlanningMap.values());
        console.log('📋 Unique planning entries (grouped by emp+shift):', uniquePlanning);

        // Create one entry per employee per shift
        const employeeShiftEntries = uniquePlanning.map(plan => {
          const empData = employeeMap[plan.emp_id];
          if (!empData) return null;

          return {
            ...empData,
            shift: plan.shift_id,
            clockIn: "00:00",
            clockOut: "00:00",
            absent: false,
            absentComment: ""
          };
        }).filter(Boolean);

        console.log('👥 Employee-shift entries created:', employeeShiftEntries);

        // Load worktime from localStorage FIRST (for sync)
        const localStorageTimes = loadAllWorktimeForDate(currentDate);
        console.log('📦 Manager view: Loaded from localStorage', localStorageTimes);

        // Merge localStorage times with employee data
        const employeesWithWorktime = employeeShiftEntries.map(emp => {
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

        console.log('✅ Final employees array:', employeesWithWorktime);

        setEmployees(employeesWithWorktime);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();

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
                clockOut: localStorageTimes[key].clockOut,
                absent: localStorageTimes[key].absent || false,
                absentComment: localStorageTimes[key].absentComment || ""
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
              clockOut: localStorageTimes[key].clockOut,
              absent: localStorageTimes[key].absent || false,
              absentComment: localStorageTimes[key].absentComment || ""
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
            clockOut: localStorageTimes[key].clockOut,
            absent: localStorageTimes[key].absent || false,
            absentComment: localStorageTimes[key].absentComment || ""
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

  // LOAD ALL SHIFTS FOR EACH EMPLOYEE - FIXED FOR MULTIPLE SHIFTS
  useEffect(() => {
    const loadShifts = async () => {
      if (!currentDate || employees.length === 0) return;

      try {
        // Get unique employee IDs from employees array
        const uniqueEmpIds = [...new Set(employees.map(emp => emp.num))];
        
        const updatedShifts = await uniqueEmpIds.reduce(async (accPromise, empId) => {
          const acc = await accPromise;

          const res = await fetch(`${API_BASE_URL}/api/planning/employee-shifts-all/${empId}/${currentDate}`); 
          if (!res.ok) return acc;
          
          const data = await res.json(); 
          
          const shiftIds = data
            .map(shift => shift.shift_id ? shift.shift_id.toString() : null)
            .filter(id => id !== null);

          acc[empId] = shiftIds;

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
      
      // Don't automatically add to employees list - wait for planning
      alert(`Employee "${name}" added successfully! Assign them to shifts in the planning.`);
      
    } catch (err) {
      alert('Error adding employee: ' + err.message);
    }
  };

  // DELETE EMPLOYEE
  const handleEmployeeDeleted = async (employeeId) => {
    try {
      await employeesApi.deleteEmployee(employeeId);
      // Remove all entries for this employee (all shifts)
      setEmployees(prev => prev.filter(emp => emp.num !== employeeId));
      alert("Employee deleted successfully!");
      
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