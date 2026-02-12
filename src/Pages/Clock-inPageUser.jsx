import '../App.css'
import Header from "../Components/HeaderUser"
import Content from "../Components/ContentUser"
import TextField from "../Components/TextField"
import { useState, useEffect } from "react";
import { employeesApi } from "../services/employeesAPI";
import { worktimeApi } from "../services/worktimeAPI";
import { API_BASE_URL } from "../services/config";

// Function to calculate work hours, late minutes, and overtime
function calculateWorkTime(shiftStart, shiftEnd, clockIn, clockOut) {
  // ... (calculateWorkTime function remains unchanged)
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
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [plannedShift, setPlannedShift] = useState(null); 
  const [selectedShifts, setSelectedShifts] = useState({});

 useEffect(() => {
 const loadShifts = async () => {
 if (!currentDate) return;

 try {
 // Use the standard reduce pattern to build the map
 const updatedShifts = await employees.reduce(async (accPromise, emp) => {
 const acc = await accPromise; // Resolve the accumulator promise

 // IMPORTANT: Change the API endpoint to return ALL shifts for the day
 const res = await fetch(`${API_BASE_URL}/api/planning/employee-shifts-all/${emp.num}/${currentDate}`); 
 if (!res.ok) return acc;
 
 // ASSUME the API returns an ARRAY of shift objects
 const data = await res.json(); 
 
 // Extract all shift IDs into an array
 const shiftIds = data
 .map(shift => shift.shift_id ? shift.shift_id.toString() : null)
 .filter(id => id !== null); // Remove null/undefined

 acc[emp.num] = shiftIds; // Store the ARRAY of shifts

 return acc;
 }, Promise.resolve({})); // Start with an empty object resolve to handle async/await

 // This is the correct array-based assignment
 setSelectedShifts(updatedShifts); 
 } catch (err) {
 console.error("Error fetching shifts:", err);
 setSelectedShifts({});
 }
 };

 loadShifts();
  }, [currentDate, employees]); // ✅ run whenever date or employees change




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


  // FETCH EMPLOYEES
//   useEffect(() => {
//     const fetchEmployees = async () => {
//       setLoading(true);
//       try {
//         const employeesData = await employeesApi.getEmployees();

//         const transformedEmployees = employeesData.map(emp => ({
//           num: emp.emp_id,
//           name: emp.name,
//           clockIn: "00:00",
//           clockOut: "00:00",
//           shift: 0,
//         }));

//         const today = currentDate
//           ? (currentDate instanceof Date ? currentDate.toISOString().split('T')[0] : currentDate)
//           : new Date().toISOString().split('T')[0];

//         const employeesWithShifts = await Promise.all(
//           transformedEmployees.map(async emp => {
//             try {
//               console.log(`Fetching shift for employee ${emp.num} on date ${today}`);
//               const res = await fetch(`http://localhost:3001/api/planning/employee-shift/${emp.num}/${today}`);
//               if (!res.ok) return { ...emp, shift: 0 };
//               const data = await res.json();
//               return { ...emp, shift: data.shift_id || 0 };
//             } catch {
//               return { ...emp, shift: 0 };
//             }
//           })
//         );

//         setEmployees(employeesWithShifts);
//         // ❌ REMOVED: Initializing selectedShifts here conflicts with the array logic above.
//         // The loadShifts effect handles the shift assignments correctly now.
//         setError(null);

//       } catch (err) {
//         console.error('Error fetching employees:', err);
//         setError('Failed to load employees');
//         setEmployees([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchEmployees();
//   }, [currentDate]);
useEffect(() => {
  if (!currentDate) return;

  const cacheKey = `employees_${currentDate}`;

  const fetchEmployees = async () => {
    console.log("🏃👷👷👷👷👷👷Employees fetched: ",employeesData);
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      setEmployees(JSON.parse(cached));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const employeesData = await employeesApi.getEmployees();
      

      const transformedEmployees = employeesData.map(emp => ({
          empNumber: emp.emp_number,
          num: emp.emp_id,
          FirstName: emp.FirstName,  // ✅ Ajouté
          LastName: emp.LastName,    // ✅ Ajouté
          clockIn: "00:00",
          clockOut: "00:00",
          shift: 0,
      }));

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

// ... (rest of the component remains unchanged)

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


  return (
    <>
      <Header />
      <TextField label="Date" value={currentDate} readOnly />
      <Content
        employees={employees}
        selectedShifts={selectedShifts}       // ✅ pass the state
        setSelectedShifts={setSelectedShifts} // ✅ pass the setter
        onEmployeeDeleted={handleEmployeeDeleted} />

    </>
  );

}

export default ClockInPage;


