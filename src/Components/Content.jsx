import { useState, useEffect } from "react"; 
import { worktimeApi } from "../services/worktimeAPI";
import { shiftApi } from "../services/shfitAPI.js"; 

export default function Content({ employees, selectedShifts, setSelectedShifts, onEmployeeDeleted }) {
  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return defaultValue;
    }
  };

    // Save to localStorage
  const saveToLocalStorage = (key, value) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
      }
  };

  const savedTimes = loadFromLocalStorage('employeeTimes', {});


  const [shifts, setShifts] = useState([]);
  const [currentTab, setCurrentTab] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newShift, setNewShift] = useState({ start_time: "", end_time: "" });
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [filteredEmployees, setFilteredEmployees] = useState([]);

  const [manualInput, setManualInput] = useState({
  employee: null,
  type: null,      // "clockIn" or "clockOut"
  value: ""
  });



  // State for employee times with localStorage persistence
  const [employeeTimes, setEmployeeTimes] = useState(() => {
      const defaultTimes = {};
      employees.forEach(emp => {  
        defaultTimes[emp.num] = {
          clockIn: "00:00",
          clockOut: "00:00",
          workTimeId: null
        };
      });
      
      // Merge saved times with default structure
      return {
        ...defaultTimes,
        ...savedTimes
      };
    }
  );

 
  

  useEffect(() => {
  if (!currentTab) {
    setFilteredEmployees([]);
    return;
  }

  const current = String(currentTab);
  const newFiltered = employees.filter((emp) => {
    const assignedShifts = selectedShifts[emp.num];
    if (!assignedShifts) return false;
    return Array.isArray(assignedShifts)
      ? assignedShifts.map(String).includes(current)
      : String(assignedShifts) === current;
  });

  setFilteredEmployees(newFiltered);
  }, [currentTab, employees, selectedShifts]); // runs only when these change




  //Load shifts from backend on page load
  useEffect(() => {
    const fetchShifts = async () => {
      const data = await shiftApi.getShifts();
      setShifts(data);
      if (data.length > 0) setCurrentTab(data[0].shift_id);
    };
    fetchShifts();
  }, []);
 
  

  const getShiftById = (shiftId) => {
  if (!shiftId || !shifts.length) return null;
  return shifts.find(s => s.shift_id === Number(shiftId)) || null;
  };

  // DELETE SHIFT
  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm("Are you sure you want to delete this shift?")) return;
    console.log("HELLLLLLLO",shiftId)

    const deleted = await shiftApi.deleteShift(shiftId);
    if (!deleted) return;

    // Update UI: remove deleted shift
    setShifts(shifts.filter((s) => s.shift_id !== shiftId));
  };

  const handleEditShift = (shift) => {
  setEditingShift(shift);     // preload form
  setShowAddForm(true);       // open the same form
  };

  const handleSubmitEditShift = async (e) => {
  e.preventDefault();
  if (!editingShift) return;

  const updated = await shiftApi.updateShift(editingShift.shift_id, {
    start_time: editingShift.start_time,
    end_time: editingShift.end_time,
  });

  if (!updated) return;

  setShifts(shifts.map((s) => s.shift_id === editingShift.shift_id ? updated : s));


  setEditingShift(null);
  setShowAddForm(false);
  };

  const handleSubmitShift = async (e) => {
  e.preventDefault();

  const added = await shiftApi.addShift(newShift);
  if (!added) return;

  // Add the new shift and sort by start_time
  const updatedShifts = [...shifts, added].sort((a, b) => {
    const timeToMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });

  setShifts(updatedShifts);
  setShowAddForm(false);
  setNewShift({ start_time: "", end_time: "" });
};

  // Load from localStorage on component mount
// const loadFromLocalStorage = (key, defaultValue) => {
//     try {
//       const item = window.localStorage.getItem(key);
//       return item ? JSON.parse(item) : defaultValue;
//     } catch (error) {
//       console.error(`Error loading ${key} from localStorage:`, error);
//       return defaultValue;
//     }
// };

//   // Save to localStorage
// const saveToLocalStorage = (key, value) => {
//     try {
//       window.localStorage.setItem(key, JSON.stringify(value));
//     } catch (error) {
//       console.error(`Error saving ${key} to localStorage:`, error);
//     }
// };

// const [manualInput, setManualInput] = useState({
//   employee: null,
//   type: null,      // "clockIn" or "clockOut"
//   value: ""
// });

//   // State for employee times with localStorage persistence
// const [employeeTimes, setEmployeeTimes] = useState(() => {
//     const defaultTimes = {};
//     employees.forEach(emp => {  
//       defaultTimes[emp.num] = {
//         clockIn: "00:00",
//         clockOut: "00:00",
//         workTimeId: null
//       };
//     });
    
//     // Merge saved times with default structure
//     return {
//       ...defaultTimes,
//       ...savedTimes
//     };
//   }
// );

   // Copy the entire week planning to localStorage
const copyWeek = () => {
      try {
        localStorage.setItem('copiedWeek', JSON.stringify(employeeTimes));
        alert('Week planning copied!');
      } catch (error) {
        console.error('Error copying week:', error);
        alert('Failed to copy week planning');
      }
};

    // Paste the copied week planning
const pasteWeek = () => {
      try {
        const copied = localStorage.getItem('copiedWeek');
        if (!copied) {
          alert('No copied week found!');
          return;
        }

        const parsed = JSON.parse(copied);

        // Merge with current employees
        const updatedTimes = { ...employeeTimes };
        employees.forEach(emp => {
          if (parsed[emp.num]) {
            updatedTimes[emp.num] = parsed[emp.num];
          }
        });

        setEmployeeTimes(updatedTimes);
        alert('Week planning pasted!');
      } catch (error) {
        console.error('Error pasting week:', error);
        alert('Failed to paste week planning');
      }
};

// const savedTimes = loadFromLocalStorage('employeeTimes', {});

//     // Merge saved times with default structure
//     return {
//       ...defaultTimes,
//       ...savedTimes
//     };
//   }
// );

  // Save to localStorage whenever state changes
useEffect(() => {
    saveToLocalStorage('selectedShifts', selectedShifts);
}, [selectedShifts]);

useEffect(() => {
    saveToLocalStorage('employeeTimes', employeeTimes);
}, [employeeTimes]);

// Update employeeTimes when employees prop changes
useEffect(() => {
    setEmployeeTimes(prev => {
      const updatedTimes = { ...prev };
      let hasChanges = false;

      employees.forEach(emp => {
        if (!updatedTimes[emp.num]) {
          updatedTimes[emp.num] = {
            clockIn: "00:00",
            clockOut: "00:00",
            workTimeId: null
          };
          hasChanges = true;
        }
      });

      // Remove employees that are no longer in the list
      Object.keys(updatedTimes).forEach(empNum => {
        if (!employees.find(emp => emp.num.toString() === empNum)) {
          delete updatedTimes[empNum];
          hasChanges = true;
        }
      });

      return hasChanges ? updatedTimes : prev;
    });
  }, [employees]
);

// Open the popup to manually edit a time
const openManualInput = (employeeNum, type) => {
const existingValue = employeeTimes[employeeNum]?.[type] || "";

  setManualInput({
    employee: employeeNum,
    type: type,
    value: existingValue
  });
};

// Save the edited manual time
const saveManualTime = () => {
  const { employee, type, value } = manualInput;

  if (!value.match(/^\d{2}:\d{2}$/)) {
    alert("Invalid time format. Use HH:MM");
    return;
  }

    const updatedTimes = {
    ...employeeTimes[employee],
    [type]: value
  };

  setEmployeeTimes(prev => ({
    ...prev,
    [employee]: updatedTimes
  }));


  // If both are filled, auto-save
  if (updatedTimes.clockIn && updatedTimes.clockOut && updatedTimes.clockIn !== "00:00" && updatedTimes.clockOut !== "00:00") {
    saveWorkTimeToDB(employee, updatedTimes.clockIn, updatedTimes.clockOut, updatedTimes.workTimeId || null);
  }

  // Close popup
  setManualInput({ employee: null, type: null, value: "" });
};

  // Calculate if employee is late
//   const calculateLateMinutes = (clockIn, shiftNumber) => {
//     if (clockIn === "00:00" || !shiftNumber || !shiftTimes[shiftNumber]) {
//       return 0;
//     }

//     const shiftStart = shiftTimes[shiftNumber].start;
//     const [clockInHours, clockInMinutes] = clockIn.split(':').map(Number);
//     const [shiftStartHours, shiftStartMinutes] = shiftStart.split(':').map(Number);

//     const clockInTotalMinutes = clockInHours * 60 + clockInMinutes;
//     const shiftStartTotalMinutes = shiftStartHours * 60 + shiftStartMinutes;

//     // Handle overnight shifts (shift 3)
//     let lateMinutes = clockInTotalMinutes - shiftStartTotalMinutes;

//     // For shift 3 (16:00-00:00), if clock in is after midnight, adjust calculation
//     if (shiftNumber === 3 && clockInHours < 12) {
//       lateMinutes = (clockInTotalMinutes + (24 * 60)) - shiftStartTotalMinutes;
//     }

//     return lateMinutes > 0 ? lateMinutes : 0; // Return 0 if not late
//   };
const calculateLateMinutes = (clockIn, shiftId) => {
    if (clockIn === "00:00") return 0;

    const shift = getShiftById(shiftId);
    if (!shift) return 0;

    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const clockInM = toMinutes(clockIn);
    let shiftStartM = toMinutes(shift.start_time);

    // overnight safety
    if (clockInM < shiftStartM) shiftStartM -= 24 * 60;

    const late = clockInM - shiftStartM;
    return late > 0 ? late : 0;
};


  // Calculate overtime
//   const calculateOvertimeMinutes = (clockOut, shiftNumber) => {
//     if (clockOut === "00:00" || !shiftNumber || !shiftTimes[shiftNumber]) {
//       return 0;
//     }

//     const shiftEnd = shiftTimes[shiftNumber].end;
//     const [clockOutHours, clockOutMinutes] = clockOut.split(':').map(Number);
//     const [shiftEndHours, shiftEndMinutes] = shiftEnd.split(':').map(Number);

//     const clockOutTotalMinutes = clockOutHours * 60 + clockOutMinutes;
//     let shiftEndTotalMinutes = shiftEndHours * 60 + shiftEndMinutes;

//     // Handle overnight shifts (shift 3 ends at 00:00 which is 24:00)
//     if (shiftNumber === 3 && shiftEndTotalMinutes === 0) {
//       shiftEndTotalMinutes = 24 * 60; // 00:00 = 24:00
//     }

//     const overtimeMinutes = clockOutTotalMinutes - shiftEndTotalMinutes;
//     return overtimeMinutes > 0 ? overtimeMinutes : 0;
//   };
const calculateOvertimeMinutes = (clockOut, shiftId) => {
    if (clockOut === "00:00") return 0;

    const shift = getShiftById(shiftId);
    if (!shift) return 0;

    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    let clockOutM = toMinutes(clockOut);
    let shiftEndM = toMinutes(shift.end_time);

    // handle overnight shift ending at 00:00
    if (shiftEndM === 0) shiftEndM = 24 * 60;
    if (clockOutM < shiftEndM) clockOutM += 24 * 60;

    const overtime = clockOutM - shiftEndM;
    return overtime > 0 ? overtime : 0;
};


// Format minutes to HH:MM
const formatMinutesToTime = (totalMinutes) => {
    if (totalMinutes <= 0) return "00:00";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Calculate hours worked
const calculateHours = (clockIn, clockOut) => {
    if (clockIn === "00:00" || clockOut === "00:00") {
      return "00:00";
    }

    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    const [outHours, outMinutes] = clockOut.split(':').map(Number);

    const totalInMinutes = inHours * 60 + inMinutes;
    const totalOutMinutes = outHours * 60 + outMinutes;

    let diffMinutes = totalOutMinutes - totalInMinutes;

    // Handle overnight shifts
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Function to get current time in HH:MM format
const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

// Function to get current date in YYYY-MM-DD format
const getCurrentDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

// Handle shift selection
const handleShiftChange = (employeeNum, shiftValue) => {
    setSelectedShifts(prev => ({
      ...prev,
      [employeeNum]: shiftValue
    }));
};

// Save work time to database
const saveWorkTimeToDB = async (employeeNum, clockIn, clockOut) => {
    try {
      // 🛑 FIX 3a: Since selectedShifts[employeeNum] is now an array, we must pick one.
      // Use the currently active tab shift for calculation when saving.
      const shiftNumber = currentTab;
      const lateMinutes = calculateLateMinutes(clockIn, shiftNumber);
      const overtimeMinutes = calculateOvertimeMinutes(clockOut, shiftNumber);
      const timeOfWork = calculateHours(clockIn, clockOut);

      const workTimeData = {
        employeeId: employeeNum,
        date: getCurrentDate(),
        clockIn: clockIn,
        clockOut: clockOut,
        timeOfWork: timeOfWork,
        shift: shiftNumber || 0, // Use the current tab shift number
        delay: formatMinutesToTime(lateMinutes),
        overtime: formatMinutesToTime(overtimeMinutes),
        late_minutes: lateMinutes,
        consomation: employeeTimes[employeeNum]?.consomation || 0,
        penalty: employeeTimes[employeeNum]?.penalty || 0,
        bonus: employeeTimes[employeeNum]?.bonus || 0
      };

      const savedWorkTime = await worktimeApi.saveWorkTime(workTimeData);

      setEmployeeTimes(prev => ({
        ...prev,
        [employeeNum]: {
          ...prev[employeeNum], 
          workTimeId: savedWorkTime.id
        }
      }));

      console.log('Work time saved successfully:', savedWorkTime);
      return savedWorkTime;
    } catch (error) {
      console.error('Error saving work time:', error);
      alert('Error saving work time to database');
    }
};

// Handle clock in
const handleClockIn = (employeeNum) => {
    const currentTime = getCurrentTime();
    const updatedTimes = {
      ...employeeTimes[employeeNum],
      clockIn: currentTime
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [employeeNum]: updatedTimes
    }));

    if (updatedTimes.clockOut !== "00:00") {
      saveWorkTimeToDB(employeeNum, currentTime, updatedTimes.clockOut);
    }
};

// Handle clock out
const handleClockOut = (employeeNum) => {
    const currentTime = getCurrentTime();
    const updatedTimes = {
      ...employeeTimes[employeeNum],
      clockOut: currentTime
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [employeeNum]: updatedTimes
    }));

    if (updatedTimes.clockIn !== "00:00") {
      saveWorkTimeToDB(employeeNum, updatedTimes.clockIn, currentTime);
    }
};

// Add a function to clear all data (optional, for testing)
const clearLocalData = () => {
      localStorage.removeItem('employeeTimes');

  // Reset only the employeeTimes data
  setEmployeeTimes(prev => {
    const resetTimes = {};
    employees.forEach(emp => {
      resetTimes[emp.num] = {
        clockIn: "00:00",
        clockOut: "00:00",
        workTimeId: null,
        consomation: 0,
        penalty: 0,
        bonus: 0
      };
    });
    return resetTimes;
  });

  alert('All clock-in/out and related fields have been reset!');
};

// Get current time for an employee
const getEmployeeTime = (employeeNum, type) => {
    return employeeTimes[employeeNum]?.[type] || "00:00";
};

// Get display values for delay and overtime
const getDisplayDelay = (employeeNum) => {
    const clockIn = getEmployeeTime(employeeNum, 'clockIn');
    const shiftNumber = parseInt(selectedShifts[employeeNum]);
    const lateMinutes = calculateLateMinutes(clockIn, shiftNumber);
    return formatMinutesToTime(lateMinutes);
};

const getDisplayOvertime = (employeeNum) => {
    const clockOut = getEmployeeTime(employeeNum, 'clockOut');
    const shiftNumber = parseInt(selectedShifts[employeeNum]);
    const overtimeMinutes = calculateOvertimeMinutes(clockOut, shiftNumber);
    return formatMinutesToTime(overtimeMinutes);
};

//The sOOOOOOOOOOOOOOOOOOOOOLLLLLLLLLLLLLLLLLLLLLLUTION
// if (!currentTab) { return <div>Waiting for data...</div>; } 
// const filteredEmployees = employees.filter((emp) => { 
//   const current = String(currentTab); 
//   const assignedShifts = selectedShifts[emp.num];
//   // If no shifts assigned → exclude employee 
//   if (!assignedShifts) return false;
//   // Keep employee only if they belong to the current shift 
//   return Array.isArray(assignedShifts) 
//   ? assignedShifts.map(String).includes(current) 
//   : String(assignedShifts) === current; 
// });

if (!currentTab) { return <div>Waiting for data...</div>; }
return (
    <>
      {(!shifts.length || currentTab === null) ? (
      <div>Loading shifts...</div>
      ) :( 
      <>  
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          color: "black",
          fontSize: "20px",
          marginLeft: "35px",
          marginTop: "40px",
          marginBottom: "0px"
        }}
      >
        Enter clock in/out and shift number:
        <button
          className="newDay"
          onClick={clearLocalData}
        >
          Clear local data
        </button>
      </div>
      
      <div style={{ marginLeft: "35px", marginTop: "20px" }}>
        <div style={{ marginLeft: "35px", marginTop: "20px" }}>
          {/* ADD SHIFT button */}
          <button
            onClick={() => {
              setNewShift({ start_time: "", end_time: "" }); // reset
              setEditingShift(null);                         // ensure no edit mode
              setShowAddForm(true);
            }}
            style={{
              padding: "10px 15px",
              marginBottom: "15px",
              borderRadius: "8px",
              fontWeight: "bold",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            + ADD SHIFT
          </button>

          {/* ADD + EDIT Shift Form (same form) */}
          {showAddForm && (
            <form
              onSubmit={editingShift ? handleSubmitEditShift : handleSubmitShift}
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <input
                type="time"
                required
                value={
                  editingShift ? editingShift.start_time : newShift.start_time
                }
                onChange={(e) => {
                  if (editingShift) {
                    setEditingShift({
                      ...editingShift,
                      start_time: e.target.value,
                    });
                  } else {
                    setNewShift({
                      ...newShift,
                      start_time: e.target.value,
                    });
                  }
                }}
              />

              <input
                type="time"
                required
                value={
                  editingShift ? editingShift.end_time : newShift.end_time
                }
                onChange={(e) => {
                  if (editingShift) {
                    setEditingShift({
                      ...editingShift,
                      end_time: e.target.value,
                    });
                  } else {
                    setNewShift({
                      ...newShift,
                      end_time: e.target.value,
                    });
                  }
                }}
              />

              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(to right, #FAB12F, #FA812F)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {editingShift ? "Update" : "Save"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingShift(null);
                  setNewShift({ start_time: "", end_time: "" });
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#6c757d",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </form>
          )}

          {/* SHIFTS LIST */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            {console.log("SHIFTS:", shifts)}
            {shifts.map((shift) => (
              <div key={shift.shift_id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                
                {/* <button className="newDay">
                  Shift ({shift.start_time} - {shift.end_time})
                </button> */}
                <button
                  className="newDay"
                  onClick={() => setCurrentTab(shift.shift_id)}
                  style={{
                    backgroundColor: currentTab === shift.shift_id ? "#28a745" : "#6c757d",
                    color: "white"
                  }}
                >
                  Shift ({shift.start_time} - {shift.end_time})
                </button>


                {/* Edit */}
                <button
                  onClick={() => handleEditShift(shift)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "5px",
                    border: "none",
                    backgroundColor: "#28a745",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  ✏️
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteShift(shift.shift_id)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "5px",
                    border: "none",
                    backgroundColor: "#dc3545",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  🗑️
                </button>

              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <table border="1" cellPadding="20" cellSpacing="0">
          <thead>
            <tr>
              {/* <th>Num</th> */}
              <th>Full name</th>
              <th>Clock in</th>
              <th>Clock out</th>
              {/* <th>Shift number</th> */}
              <th>Consomation</th>
              <th>Penalty</th>
              <th>Bonus</th>
              <th>Delay</th>
              <th>Overtime</th>
              <th>Hours</th>
              {/* <th>Operations</th> */}
            </tr>
          </thead>
         <tbody>
          {
          // employees.filter((emp) => {
          // // if (!currentTab) return true;
          // if (!currentTab) { return <div>Waiting for data...</div>; }

          // const current = String(currentTab);
          // const assignedShifts = selectedShifts[emp.num];

          // // No shift assignment yet → do not hide employee
          // // if (!assignedShifts) return true;
          //  if (!assignedShifts) return false;

          // return Array.isArray(assignedShifts)
          //   ? assignedShifts.map(String).includes(current)
          //   : String(assignedShifts) === current;
          // })
          filteredEmployees
          .map((emp) => {
                      const currentClockIn = getEmployeeTime(emp.num, 'clockIn');
                      const currentClockOut = getEmployeeTime(emp.num, 'clockOut');
                      const currentDelay = getDisplayDelay(emp.num);
                      const currentOvertime = getDisplayOvertime(emp.num);
                      return (
                        <tr key={emp.num}>
                          {/* <td>{emp.num}</td> */}
                          <td>{emp.name}</td>
                          <td>
                            <button
                              className="time-button"
                              onClick={() => handleClockIn(emp.num)}
                              style={{
                                background: currentClockIn === "00:00" ? '#6c757d' : '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                width: '100%'
                              }}
                            >
                              Clock In<br />{currentClockIn}
                            </button>
                            <button
                              style={{
                                marginTop: "3px",
                                background: "#ffc107",
                                color: "black",
                                padding: "4px 6px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                width: "100%"
                              }}
                              onClick={() => openManualInput(emp.num, "clockIn")}
                            >
                              Edit Clock In
                            </button>
                          </td>
                           <td>
                            <button
                              className="time-button"
                              onClick={() => handleClockOut(emp.num)}
                              style={{
                                background: currentClockOut === "00:00" ? '#6c757d' : '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                width: '100%'
                              }}
                            >
                              Clock Out<br />{currentClockOut}
                            </button>
                          <button
                            style={{
                              marginTop: "3px",
                              background: "#ffc107",
                              color: "black",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              width: "100%"
                            }}
                            onClick={() => openManualInput(emp.num, "clockOut")}
                          >
                            Edit Clock Out
                          </button>

                          </td>
                        {/*  <td>
                            <div style={{ 
                              textAlign: 'center', 
                              fontWeight: 'bold', 
                              fontSize: '16px',
                              padding: '8px'
                            }}>
                              {Array.isArray(selectedShifts[emp.num]) ? selectedShifts[emp.num].join(', ') : selectedShifts[emp.num] || "N/A"}
                            </div>
                          </td>*/}
                          <td>
                          <input
                            type="number"
                            value={employeeTimes[emp.num]?.consomation || ""}
                            onChange={(e) =>
                              setEmployeeTimes((prev) => ({
                                ...prev,
                                [emp.num]: {
                                  ...prev[emp.num],
                                  consomation: e.target.value,
                                },
                              }))
                            }
                            style={{ width: "80px" }}
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            value={employeeTimes[emp.num]?.penalty || ""}
                            onChange={(e) =>
                              setEmployeeTimes((prev) => ({
                                ...prev,
                                [emp.num]: {
                                  ...prev[emp.num],
                                  penalty: e.target.value,
                                },
                              }))
                            }
                            style={{ width: "80px" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={employeeTimes[emp.num]?.bonus || ""}
                            onChange={(e) =>
                              setEmployeeTimes((prev) => ({
                                ...prev,
                                [emp.num]: {
                                  ...prev[emp.num],
                                  bonus: e.target.value,
                                },
                              }))
                            }
                            style={{ width: "80px" }}
                          />

                       </td>

                          <td>{currentDelay}</td>
                          <td>{currentOvertime}</td>
                          <td>{calculateHours(currentClockIn, currentClockOut)}</td>
                          
                        </tr>
                      );})}
          </tbody>
        </table>
       </div>
      {manualInput.employee && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
            zIndex: 9999
          }}
        >
          <h3>
            Edit {manualInput.type === "clockIn" ? "Clock-In" : "Clock-Out"} Time
          </h3>

          <input
            type="time"
            value={manualInput.value}
            onChange={(e) =>
              setManualInput(prev => ({ ...prev, value: e.target.value }))
            }
            style={{
              fontSize: "18px",
              padding: "6px",
              width: "140px",
              marginTop: "10px"
            }}
          />

          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button
              onClick={saveManualTime}
              style={{
                padding: "8px 12px",
                background: "#28a745",
                color: "white",
                borderRadius: "4px"
              }}
            >
              Save
            </button>

            <button
              onClick={() =>
                setManualInput({ employee: null, type: null, value: "" })
              }
              style={{
                padding: "8px 12px",
                background: "#dc3545",
                color: "white",
                borderRadius: "4px"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
    )}
    </>
);
}