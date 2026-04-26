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

// Helper to get today's date as YYYY-MM-DD
const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function ClockInPage() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(getTodayDate);
  const [plannedShift, setPlannedShift] = useState(null);
  const [selectedShifts, setSelectedShifts] = useState({});
  const [selectedShiftsForDate, setSelectedShiftsForDate] = useState([]);

  // FETCH EMPLOYEES WITH CACHING AND WORKTIME DATA
  useEffect(() => {
    if (!currentDate) return;

    const cacheKey = `employees_${currentDate}`;

    const fetchEmployees = async () => {

      // Step 1 — show cache instantly if available (for speed)
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          setEmployees(parsedCache);
          setLoading(false);
        } catch (e) {
          localStorage.removeItem(cacheKey);
          setLoading(true);
        }
      } else {
        setLoading(true);
      }

      // Step 2 — always fetch fresh from DB in background
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

        // Fetch shift assignment for each employee
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

        // Step 3 — get fresh clock times from DB
        let dbWorktimes = [];
        try {
          dbWorktimes = await worktimeApi.getWorkTimesByDate(currentDate);
          console.log('✅ DB worktimes raw FIRST RECORD:', dbWorktimes[0]);
        } catch (e) {
          console.log('❌ DB fetch failed:', e);
          dbWorktimes = [];
        }

        console.log('👥 Employees with shifts:', employeesWithShifts.map(e => ({ num: e.num, shift: e.shift })));

        // Step 4 — merge employees with DB clock times
        const employeesWithWorktime = employeesWithShifts.map(emp => {
          const dbRecord = dbWorktimes.find(
            r => String(r.emp_id) === String(emp.num) &&
              String(r.shift_id) === String(emp.shift)
          );
          console.log(`Employee ${emp.num} shift ${emp.shift} → dbRecord:`, dbRecord);
          return {
            ...emp,
            clockIn: dbRecord?.clock_in?.slice(0, 5) || "00:00",
            clockOut: dbRecord?.clock_out?.slice(0, 5) || "00:00",
            absent: dbRecord?.absent == 1 || false,
            absentComment: dbRecord?.absent_comment || "",
            consomation: dbRecord?.consomation ?? 0,
            penalty: dbRecord?.penalty ?? 0
          };
        });

        // Step 5 — update display and save fresh cache
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

    return () => { };
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
        <label style={{ fontWeight: 500 }}>Date</label>
        <input
          type="date"
          value={currentDate}
          onChange={e => setCurrentDate(e.target.value)}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 14,
          }}
        />
        <button
          onClick={() => setCurrentDate(getTodayDate())}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid #ccc',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Today
        </button>
      </div>

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