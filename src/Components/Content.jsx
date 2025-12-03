import { useState, useEffect } from "react"; 
import { worktimeApi } from "../services/worktimeAPI";

export default function Content({ employees, selectedShifts, setSelectedShifts, onEmployeeDeleted }) {
  const shiftTimes = {
    1: { start: "06:00", end: "14:00" },
    2: { start: "08:00", end: "16:00" },
    3: { start: "16:00", end: "00:00" }
  };

  const [currentTab, setCurrentTab] = useState(1);

  // Load from localStorage on component mount
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

    const savedTimes = loadFromLocalStorage('employeeTimes', {});

    // Merge saved times with default structure
    return {
      ...defaultTimes,
      ...savedTimes
    };
  });

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
  }, [employees]);

  // Calculate if employee is late
  const calculateLateMinutes = (clockIn, shiftNumber) => {
    if (clockIn === "00:00" || !shiftNumber || !shiftTimes[shiftNumber]) {
      return 0;
    }

    const shiftStart = shiftTimes[shiftNumber].start;
    const [clockInHours, clockInMinutes] = clockIn.split(':').map(Number);
    const [shiftStartHours, shiftStartMinutes] = shiftStart.split(':').map(Number);

    const clockInTotalMinutes = clockInHours * 60 + clockInMinutes;
    const shiftStartTotalMinutes = shiftStartHours * 60 + shiftStartMinutes;

    // Handle overnight shifts (shift 3)
    let lateMinutes = clockInTotalMinutes - shiftStartTotalMinutes;

    // For shift 3 (16:00-00:00), if clock in is after midnight, adjust calculation
    if (shiftNumber === 3 && clockInHours < 12) {
      lateMinutes = (clockInTotalMinutes + (24 * 60)) - shiftStartTotalMinutes;
    }

    return lateMinutes > 0 ? lateMinutes : 0; // Return 0 if not late
  };

  // Calculate overtime
  const calculateOvertimeMinutes = (clockOut, shiftNumber) => {
    if (clockOut === "00:00" || !shiftNumber || !shiftTimes[shiftNumber]) {
      return 0;
    }

    const shiftEnd = shiftTimes[shiftNumber].end;
    const [clockOutHours, clockOutMinutes] = clockOut.split(':').map(Number);
    const [shiftEndHours, shiftEndMinutes] = shiftEnd.split(':').map(Number);

    const clockOutTotalMinutes = clockOutHours * 60 + clockOutMinutes;
    let shiftEndTotalMinutes = shiftEndHours * 60 + shiftEndMinutes;

    // Handle overnight shifts (shift 3 ends at 00:00 which is 24:00)
    if (shiftNumber === 3 && shiftEndTotalMinutes === 0) {
      shiftEndTotalMinutes = 24 * 60; // 00:00 = 24:00
    }

    const overtimeMinutes = clockOutTotalMinutes - shiftEndTotalMinutes;
    return overtimeMinutes > 0 ? overtimeMinutes : 0;
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
    const shiftNumber = currentTab; 
    const lateMinutes = calculateLateMinutes(clockIn, shiftNumber);
    return formatMinutesToTime(lateMinutes);
  };

  const getDisplayOvertime = (employeeNum) => {
    const clockOut = getEmployeeTime(employeeNum, 'clockOut');
    const shiftNumber = currentTab; 
    const overtimeMinutes = calculateOvertimeMinutes(clockOut, shiftNumber);
    return formatMinutesToTime(overtimeMinutes);
  };

  return (
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
<div style={{ display: "flex", gap: "10px", marginLeft: "35px", marginTop: "20px" }}>
  {[1, 2, 3].map((shift) => (
    <button
      key={shift}
      onClick={() => setCurrentTab(shift)}
      style={{
        padding: "10px 20px",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer",
        backgroundColor: currentTab === shift ? "#007bff" : "#ccc",
        color: "white",
        fontWeight: "bold",
      }}
    >
      Shift {shift} ({shiftTimes[shift].start} - {shiftTimes[shift].end})
    </button>
  ))}
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
{employees.filter((emp) => {
    const assignedShifts = selectedShifts[emp.num];
    const currentShift = currentTab.toString();
    
    // Check if assignedShifts is an array and includes the current tab number
    if (Array.isArray(assignedShifts)) {
        return assignedShifts.includes(currentShift);
    }


    // Fallback for single-shift value (though this should be an array now)
    return assignedShifts && assignedShifts.toString() === currentShift;
  })
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
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}