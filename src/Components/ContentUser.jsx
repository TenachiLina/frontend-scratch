import { useState, useEffect } from "react"; 
import { worktimeApi } from "../services/worktimeAPI.js";
import { shiftApi } from "../services/shfitAPI.js"; 
import { useMemo } from "react";

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

  // Helper function to create composite key
  const getEmployeeShiftKey = (empNum, shiftId = currentTab) => {
    return `${empNum}-${shiftId}`;
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

  // State for employee times with localStorage persistence - NOW WITH SHIFT KEYS
  const [employeeTimes, setEmployeeTimes] = useState(() => {
    const defaultTimes = {};
    
    // We'll initialize this properly once shifts are loaded
    employees.forEach(emp => {
      // Create a default entry for each employee (will be expanded when shifts load)
      const key = `${emp.num}-default`;
      defaultTimes[key] = {
        clockIn: "00:00",
        clockOut: "00:00",
        workTimeId: null,
        consomation: 0,
        penalty: 0,
        absent: false,
        absentComment: ""
      };
    });
    
    // Merge saved times with default structure
    return {
      ...defaultTimes,
      ...savedTimes
    };
  });

  // Helper to check if employee is absent for current shift
  const isAbsent = (empNum) => {
    const key = getEmployeeShiftKey(empNum, currentTab);
    return employeeTimes[key]?.absent === true;
  };

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
  }, [currentTab, employees, selectedShifts]);

  // Load shifts from backend on page load
  useEffect(() => {
    const fetchShifts = async () => {
      const data = await shiftApi.getShifts();
      setShifts(data);
      if (data.length > 0) setCurrentTab(data[0].shift_id);
    };
    fetchShifts();
  }, []);

  // Initialize employee times for all shifts when shifts or employees change
  useEffect(() => {
    if (shifts.length === 0) return;

    setEmployeeTimes(prev => {
      const updatedTimes = { ...prev };
      let hasChanges = false;

      employees.forEach(emp => {
        shifts.forEach(shift => {
          const key = getEmployeeShiftKey(emp.num, shift.shift_id);
          if (!updatedTimes[key]) {
            updatedTimes[key] = {
              clockIn: "00:00",
              clockOut: "00:00",
              workTimeId: null,
              consomation: 0,
              penalty: 0,
              absent: false,
              absentComment: ""
            };
            hasChanges = true;
          }
        });
      });

      // Clean up old entries for removed employees or shifts
      Object.keys(updatedTimes).forEach(key => {
        if (key.includes('-')) {
          const [empNum, shiftId] = key.split('-');
          const empExists = employees.find(emp => emp.num.toString() === empNum);
          const shiftExists = shifts.find(s => s.shift_id.toString() === shiftId);
          
          if (!empExists || !shiftExists) {
            delete updatedTimes[key];
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updatedTimes : prev;
    });
  }, [employees, shifts]);

  const getShiftById = (shiftId) => {
    if (!shiftId || !shifts.length) return null;
    return shifts.find(s => s.shift_id === Number(shiftId)) || null;
  };

  // DELETE SHIFT
  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm("Are you sure you want to delete this shift?")) return;
    console.log("HELLLLLLLO", shiftId);

    const deleted = await shiftApi.deleteShift(shiftId);
    if (!deleted) return;

    // Update UI: remove deleted shift
    setShifts(shifts.filter((s) => s.shift_id !== shiftId));
  };

  const handleEditShift = (shift) => {
    setEditingShift(shift);
    setShowAddForm(true);
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
        shifts.forEach(shift => {
          const key = getEmployeeShiftKey(emp.num, shift.shift_id);
          if (parsed[key]) {
            updatedTimes[key] = parsed[key];
          }
        });
      });

      setEmployeeTimes(updatedTimes);
      alert('Week planning pasted!');
    } catch (error) {
      console.error('Error pasting week:', error);
      alert('Failed to paste week planning');
    }
  };

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToLocalStorage('selectedShifts', selectedShifts);
  }, [selectedShifts]);

  useEffect(() => {
    saveToLocalStorage('employeeTimes', employeeTimes);
  }, [employeeTimes]);

  // Open the popup to manually edit a time
  const openManualInput = (employeeNum, type) => {
    const key = getEmployeeShiftKey(employeeNum, currentTab);
    const existingValue = employeeTimes[key]?.[type] || "";

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

    const key = getEmployeeShiftKey(employee, currentTab);
    const updatedTimes = {
      ...employeeTimes[key],
      [type]: value
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [key]: updatedTimes
    }));

    // If both are filled, auto-save
    if (updatedTimes.clockIn && updatedTimes.clockOut && 
        updatedTimes.clockIn !== "00:00" && updatedTimes.clockOut !== "00:00") {
      saveWorkTimeToDB(employee, updatedTimes.clockIn, updatedTimes.clockOut, updatedTimes.workTimeId || null);
    }

    // Close popup
    setManualInput({ employee: null, type: null, value: "" });
  };

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
    
    // Only add 24 hours to clockOut if it's actually an overnight situation
    // (i.e., shift crosses midnight AND clockOut is in the early morning hours)
    if (shiftEndM === 24 * 60 && clockOutM < 12 * 60) {
      // Shift ends at midnight, and clock out is in early morning (00:00 - 11:59)
      clockOutM += 24 * 60;
    }

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
      const shiftNumber = currentTab;
      const lateMinutes = calculateLateMinutes(clockIn, shiftNumber);
      const overtimeMinutes = calculateOvertimeMinutes(clockOut, shiftNumber);
      const timeOfWork = calculateHours(clockIn, clockOut);
      
      const key = getEmployeeShiftKey(employeeNum, currentTab);
      
      console.log("API = ", import.meta.env.VITE_API_BASE_URL);

      const workTimeData = {
        employeeId: employeeNum,
        date: getCurrentDate(),
        clockIn: clockIn,
        clockOut: clockOut,
        timeOfWork: timeOfWork,
        shift: shiftNumber || 0,
        delay: formatMinutesToTime(lateMinutes),
        overtime: formatMinutesToTime(overtimeMinutes),
        late_minutes: lateMinutes,
        consomation: employeeTimes[key]?.consomation || 0,
        penalty: employeeTimes[key]?.penalty || 0,
        absent: employeeTimes[key]?.absent ? 1 : 0,
        absentComment: employeeTimes[key]?.absentComment || ""
      };

      const savedWorkTime = await worktimeApi.saveWorkTime(workTimeData);

      setEmployeeTimes(prev => ({
        ...prev,
        [key]: {
          ...prev[key], 
          workTimeId: savedWorkTime.id
        }
      }));
      
      console.log('absence:', employeeTimes[key]?.absentComment);
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
    const key = getEmployeeShiftKey(employeeNum, currentTab);
    
    const updatedTimes = {
      ...employeeTimes[key],
      clockIn: currentTime
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [key]: updatedTimes
    }));

    if (updatedTimes.clockOut !== "00:00") {
      saveWorkTimeToDB(employeeNum, currentTime, updatedTimes.clockOut);
    }
  };

  // Handle clock out
  const handleClockOut = (employeeNum) => {
    const currentTime = getCurrentTime();
    const key = getEmployeeShiftKey(employeeNum, currentTab);
    
    const updatedTimes = {
      ...employeeTimes[key],
      clockOut: currentTime
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [key]: updatedTimes
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
        shifts.forEach(shift => {
          const key = getEmployeeShiftKey(emp.num, shift.shift_id);
          resetTimes[key] = {
            clockIn: "00:00",
            clockOut: "00:00",
            workTimeId: null,
            consomation: 0,
            penalty: 0,
            absent: false,
            absentComment: ""
          };
        });
      });
      return resetTimes;
    });

    alert('All clock-in/out and related fields have been reset!');
  };

  // Get current time for an employee (for specific shift)
  const getEmployeeTime = (employeeNum, type, shiftId = currentTab) => {
    const key = getEmployeeShiftKey(employeeNum, shiftId);
    return employeeTimes[key]?.[type] || "00:00";
  };

  // Get display values for delay and overtime
  const getDisplayDelay = (employeeNum) => {
    const clockIn = getEmployeeTime(employeeNum, 'clockIn', currentTab);
    const lateMinutes = calculateLateMinutes(clockIn, currentTab);
    return formatMinutesToTime(lateMinutes);
  };

  const getDisplayOvertime = (employeeNum) => {
    const clockOut = getEmployeeTime(employeeNum, 'clockOut', currentTab);
    const overtimeMinutes = calculateOvertimeMinutes(clockOut, currentTab);
    return formatMinutesToTime(overtimeMinutes);
  };

  if (!currentTab) { 
    return <div>Waiting for data...</div>; 
  }

  return (
    <>
      {(!shifts.length || currentTab === null) ? (
        <div>Loading shifts...</div>
      ) : ( 
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

                    

                    
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <table border="1" cellPadding="20" cellSpacing="0">
              <thead>
                <tr>
                  <th>Full name</th>
                  <th>Clock in</th>
                  <th>Clock out</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const key = getEmployeeShiftKey(emp.num, currentTab);
                  const currentClockIn = getEmployeeTime(emp.num, 'clockIn', currentTab);
                  const currentClockOut = getEmployeeTime(emp.num, 'clockOut', currentTab);
                  const currentDelay = getDisplayDelay(emp.num);
                  const currentOvertime = getDisplayOvertime(emp.num);
                  
                  return (
                    <tr 
                      key={`${emp.num}-${currentTab}`}
                      style={{
                        backgroundColor: employeeTimes[key]?.absent ? '#f8f9fa' : 'transparent',
                        opacity: employeeTimes[key]?.absent ? 0.6 : 1,
                      }}
                    >
                      <td>{emp.name}</td>
                      <td>
                        {!isAbsent(emp.num) && (
                          <>
                            <button
                              className="time-button"
                              onClick={() => handleClockIn(emp.num)}
                              style={{
                                background: currentClockIn === "00:00" ? '#6c757d' : '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '20px 20px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                width: '100%'
                              }}
                            >
                              Clock In<br />
                            </button>
                            
                          </>
                        )}
                        {isAbsent(emp.num) && (
                          <div style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
                            Absent
                          </div>
                        )}
                      </td>

                      <td>
                        {!isAbsent(emp.num) && (
                          <>
                            <button
                              className="time-button"
                              onClick={() => handleClockOut(emp.num)}
                              style={{
                                background: currentClockOut === "00:00" ? '#6c757d' : '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '20px 20px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                width: '100%'
                              }}
                            >
                              Clock Out<br />
                            </button>
                            
                          </>
                        )}
                        {isAbsent(emp.num) && (
                          <div style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
                            Absent
                          </div>
                        )}
                      </td>


                      
                    
                   
                    </tr>
                  );
                })}
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
