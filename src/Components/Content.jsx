import { useState, useEffect } from "react"; 
import { worktimeApi } from "../services/worktimeAPI";
import { shiftApi } from "../services/shfitAPI.js";
import { planningApi } from "../services/planningAPI";
import { API_BASE_URL } from "../services/config";
import { 
  saveWorktimeToLocalStorage, 
  clearEmployeeCache 
} from "../services/worktimeSync";

export default function Content({ employees, selectedShifts, selectedShiftsForDate, setSelectedShifts, onEmployeeDeleted, currentDate }) {
  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return defaultValue;
    }
  };

  const saveToLocalStorage = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  const getEmployeeShiftKey = (empNum, shiftId = currentTab) => {
    return `${empNum}-${shiftId}`;
  };

  const savedTimes = loadFromLocalStorage('employeeTimes', {});

  const [shifts, setShifts] = useState([]);
  const [currentTab, setCurrentTab] = useState(null);

  const [filteredEmployees, setFilteredEmployees] = useState([]);

  const [manualInput, setManualInput] = useState({
    employee: null,
    type: null,
    value: ""
  });

  // Use a merged state: localStorage for penalties/consomation/absent, but clockIn/clockOut from props
  const [employeeTimes, setEmployeeTimes] = useState({});

  const [customShiftTimes, setCustomShiftTimes] = useState({});

  const isAbsent = (empNum) => {
    const key = getEmployeeShiftKey(empNum, currentTab);
    return employeeTimes[key]?.absent === true;
  };

  // Sync employee times with both props and localStorage
  useEffect(() => {
    if (employees.length === 0) return;

    setEmployeeTimes(prev => {
      const updatedTimes = {};

      employees.forEach(emp => {
        // Use employee's shift from props
        const shiftId = emp.shift || currentTab;
        if (!shiftId) return;

        const key = `${emp.num}-${shiftId}`;
        
        // Merge: clockIn/clockOut/absent from props, other fields from previous state or localStorage
        // If we have a recent local change (within 2 seconds), keep it instead of overwriting
        const existingTime = prev[key];
        const timeSinceUpdate = existingTime?._lastUpdate ? (Date.now() - existingTime._lastUpdate) : Infinity;
        
        updatedTimes[key] = {
          clockIn: (timeSinceUpdate < 2000 ? existingTime?.clockIn : emp.clockIn) || "00:00",
          clockOut: (timeSinceUpdate < 2000 ? existingTime?.clockOut : emp.clockOut) || "00:00",
          absent: (timeSinceUpdate < 2000 ? existingTime?.absent : emp.absent) || false,
          absentComment: (timeSinceUpdate < 2000 ? existingTime?.absentComment : emp.absentComment) || "",
          workTimeId: prev[key]?.workTimeId || null,
          consomation: prev[key]?.consomation || savedTimes[key]?.consomation || 0,
          penalty: prev[key]?.penalty || savedTimes[key]?.penalty || 0,
          _lastUpdate: existingTime?._lastUpdate
        };
      });

      return updatedTimes;
    });
  }, [employees, currentTab]);

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

  // Use selectedShiftsForDate passed from parent
  useEffect(() => {
    if (selectedShiftsForDate && selectedShiftsForDate.length > 0) {
      setShifts(selectedShiftsForDate);
      if (!currentTab) {
        setCurrentTab(selectedShiftsForDate[0].shift_id);
      }
    }
  }, [selectedShiftsForDate]);

  // Load custom shift times from planning
  useEffect(() => {
    const loadCustomShiftTimes = async () => {
      if (!currentDate || !employees.length) return;

      try {
        const planningData = await planningApi.getPlanning(currentDate);
        
        const customTimes = {};
        planningData.forEach(assignment => {
          if (assignment.custom_start_time || assignment.custom_end_time) {
            const key = `${assignment.emp_id}-${assignment.shift_id}`;
            customTimes[key] = {
              custom_start_time: assignment.custom_start_time || '',
              custom_end_time: assignment.custom_end_time || ''
            };
          }
        });

        setCustomShiftTimes(customTimes);
      } catch (error) {
        console.error('Error loading custom shift times:', error);
      }
    };

    loadCustomShiftTimes();
  }, [currentDate, employees]);

  const getShiftById = (shiftId) => {
    if (!shiftId || !shifts.length) return null;
    return shifts.find(s => s.shift_id === Number(shiftId)) || null;
  };

  const getCustomShiftTime = (empId, shiftId, field) => {
    const key = `${empId}-${shiftId}`;
    return customShiftTimes[key]?.[field] || '';
  };

  const getEffectiveShiftTime = (empId, shiftId, field) => {
    const customTime = getCustomShiftTime(empId, shiftId, field);
    if (customTime) return customTime;

    const shift = getShiftById(shiftId);
    if (!shift) return '';

    return field === 'custom_start_time' ? shift.start_time : shift.end_time;
  };

  useEffect(() => {
    saveToLocalStorage('selectedShifts', selectedShifts);
  }, [selectedShifts]);

  useEffect(() => {
    // Only save penalty/consomation/absent to localStorage, NOT clockIn/clockOut
    const dataToSave = {};
    Object.keys(employeeTimes).forEach(key => {
      dataToSave[key] = {
        consomation: employeeTimes[key].consomation,
        penalty: employeeTimes[key].penalty,
        absent: employeeTimes[key].absent,
        absentComment: employeeTimes[key].absentComment,
        workTimeId: employeeTimes[key].workTimeId
      };
    });
    saveToLocalStorage('employeeTimes', dataToSave);
  }, [employeeTimes]);

  const openManualInput = (employeeNum, type) => {
    const key = getEmployeeShiftKey(employeeNum, currentTab);
    const existingValue = employeeTimes[key]?.[type] || "";

    setManualInput({
      employee: employeeNum,
      type: type,
      value: existingValue
    });
  };

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

    if (updatedTimes.clockIn && updatedTimes.clockOut && 
        updatedTimes.clockIn !== "00:00" && updatedTimes.clockOut !== "00:00") {
      saveWorkTimeToDB(employee, updatedTimes.clockIn, updatedTimes.clockOut, updatedTimes.workTimeId || null);
    }

    setManualInput({ employee: null, type: null, value: "" });
  };

  const calculateLateMinutes = (clockIn, empId, shiftId) => {
    if (clockIn === "00:00") return 0;

    const effectiveStartTime = getEffectiveShiftTime(empId, shiftId, 'custom_start_time');
    if (!effectiveStartTime) return 0;

    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const clockInM = toMinutes(clockIn);
    let shiftStartM = toMinutes(effectiveStartTime);

    if (clockInM < shiftStartM) shiftStartM -= 24 * 60;

    const late = clockInM - shiftStartM;
    return late > 0 ? late : 0;
  };

  const calculateOvertimeMinutes = (clockOut, empId, shiftId) => {
    if (clockOut === "00:00") return 0;

    const effectiveEndTime = getEffectiveShiftTime(empId, shiftId, 'custom_end_time');
    if (!effectiveEndTime) return 0;

    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    let clockOutM = toMinutes(clockOut);
    let shiftEndM = toMinutes(effectiveEndTime);

    if (shiftEndM === 0) shiftEndM = 24 * 60;
    
    if (shiftEndM === 24 * 60 && clockOutM < 12 * 60) {
      clockOutM += 24 * 60;
    }

    const overtime = clockOutM - shiftEndM;
    return overtime > 0 ? overtime : 0;
  };

  const formatMinutesToTime = (totalMinutes) => {
    if (totalMinutes <= 0) return "00:00";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const calculateHours = (clockIn, clockOut) => {
    if (clockIn === "00:00" || clockOut === "00:00") {
      return "00:00";
    }

    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    const [outHours, outMinutes] = clockOut.split(':').map(Number);

    const totalInMinutes = inHours * 60 + inMinutes;
    const totalOutMinutes = outHours * 60 + outMinutes;

    let diffMinutes = totalOutMinutes - totalInMinutes;

    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleShiftChange = (employeeNum, shiftValue) => {
    setSelectedShifts(prev => ({
      ...prev,
      [employeeNum]: shiftValue
    }));
  };

  const saveWorkTimeToDB = async (employeeNum, clockIn, clockOut) => {
    try {
      const shiftNumber = currentTab;
      const lateMinutes = calculateLateMinutes(clockIn, employeeNum, shiftNumber);
      const overtimeMinutes = calculateOvertimeMinutes(clockOut, employeeNum, shiftNumber);
      const timeOfWork = calculateHours(clockIn, clockOut);
      
      const key = getEmployeeShiftKey(employeeNum, currentTab);

      const workTimeData = {
        employeeId: employeeNum,
        date: currentDate,
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
      
      console.log('Work time saved successfully:', savedWorkTime);
      return savedWorkTime;
    } catch (error) {
      console.error('Error saving work time:', error);
      alert('Error saving work time to database');
    }
  };

  const handleClockIn = (employeeNum) => {
    const currentTime = getCurrentTime();
    const key = getEmployeeShiftKey(employeeNum, currentTab);
    
    const updatedTimes = {
      ...employeeTimes[key],
      clockIn: currentTime,
      _lastUpdate: Date.now()  // Mark when we made this change
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [key]: updatedTimes
    }));

    // Save to worktimeSync for instant sync between pages
    saveWorktimeToLocalStorage(employeeNum, currentDate, currentTab, currentTime, updatedTimes.clockOut || "00:00");

    if (updatedTimes.clockOut !== "00:00") {
      saveWorkTimeToDB(employeeNum, currentTime, updatedTimes.clockOut);
    }
  };

  const handleClockOut = (employeeNum) => {
    const currentTime = getCurrentTime();
    const key = getEmployeeShiftKey(employeeNum, currentTab);
    
    const updatedTimes = {
      ...employeeTimes[key],
      clockOut: currentTime,
      _lastUpdate: Date.now()  // Mark when we made this change
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [key]: updatedTimes
    }));

    // Save to worktimeSync for instant sync between pages
    saveWorktimeToLocalStorage(employeeNum, currentDate, currentTab, updatedTimes.clockIn || "00:00", currentTime);

    if (updatedTimes.clockIn !== "00:00") {
      saveWorkTimeToDB(employeeNum, updatedTimes.clockIn, currentTime);
    }
  };

  const clearLocalData = () => {
    // Clear old localStorage
    localStorage.removeItem('employeeTimes');

    // Clear ALL worktime_* keys from worktimeSync
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('worktime_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear employee cache
    clearEmployeeCache(currentDate);

    // Reset state
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

    // Trigger sync event so other pages update
    window.dispatchEvent(new Event('worktime-changed'));
    localStorage.setItem('worktime_sync_trigger', Date.now().toString());

    alert('All clock-in/out and related fields have been reset!');
  };

  const getEmployeeTime = (employeeNum, type, shiftId = currentTab) => {
    const key = getEmployeeShiftKey(employeeNum, shiftId);
    return employeeTimes[key]?.[type] || "00:00";
  };

  const getDisplayDelay = (employeeNum) => {
    const clockIn = getEmployeeTime(employeeNum, 'clockIn', currentTab);
    const lateMinutes = calculateLateMinutes(clockIn, employeeNum, currentTab);
    return formatMinutesToTime(lateMinutes);
  };

  const getDisplayOvertime = (employeeNum) => {
    const clockOut = getEmployeeTime(employeeNum, 'clockOut', currentTab);
    const overtimeMinutes = calculateOvertimeMinutes(clockOut, employeeNum, currentTab);
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
              justifyContent: "space-between",
              alignItems: "center",
              color: "black",
              fontSize: "20px",
              marginLeft: "35px",
              marginRight: "35px",
              marginTop: "40px",
              marginBottom: "20px"
            }}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <span>Shifts:</span>
              {shifts.map((shift, index) => (
                <button
                  key={shift.shift_id}
                  className="newDay"
                  onClick={() => setCurrentTab(shift.shift_id)}
                  style={{
                    backgroundColor: currentTab === shift.shift_id ? "#28a745" : "#6c757d",
                    color: "white",
                    cursor: "pointer"
                  }}
                >
                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                </button>
              ))}
            </div>
            <button
              className="newDay"
              onClick={clearLocalData}
            >
              Clear local data
            </button>
          </div>

          <div>
            <table border="1" cellPadding="20" cellSpacing="0">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Clock in</th>
                  <th>Clock out</th>
                  <th>Consomation</th>
                  <th>Penalty</th>
                  <th>Delay</th>
                  <th>Overtime</th>
                  <th>Hours</th>
                  <th>Absent?</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const key = getEmployeeShiftKey(emp.num, currentTab);
                  const currentClockIn = getEmployeeTime(emp.num, 'clockIn', currentTab);
                  const currentClockOut = getEmployeeTime(emp.num, 'clockOut', currentTab);
                  const currentDelay = getDisplayDelay(emp.num);
                  const currentOvertime = getDisplayOvertime(emp.num);
                  
                  const effectiveStartTime = getEffectiveShiftTime(emp.num, currentTab, 'custom_start_time');
                  const effectiveEndTime = getEffectiveShiftTime(emp.num, currentTab, 'custom_end_time');
                  const customStart = getCustomShiftTime(emp.num, currentTab, 'custom_start_time');
                  const customEnd = getCustomShiftTime(emp.num, currentTab, 'custom_end_time');
                  const hasCustomTime = customStart || customEnd;
                  
                  return (
                    <tr 
                      key={`${emp.num}-${currentTab}`}
                      style={{
                        backgroundColor: employeeTimes[key]?.absent ? '#f8f9fa' : 'transparent',
                        opacity: employeeTimes[key]?.absent ? 0.6 : 1,
                      }}
                    >

                      <td>
                        <div>{emp.FirstName} - {emp.empNumber}</div>
                        {hasCustomTime && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#EB4219', 
                            fontStyle: 'italic',
                            marginTop: '4px',
                            fontWeight: 'bold'
                          }}>
                            {effectiveStartTime?.slice(0, 5)} - {effectiveEndTime?.slice(0, 5)}
                          </div>
                        )}
                      </td>

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
                          </>
                        )}
                        {isAbsent(emp.num) && (
                          <div style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
                            Absent
                          </div>
                        )}
                      </td>

                      <td>
                        <input
                          type="number"
                          value={employeeTimes[key]?.consomation || ""}
                          onChange={(e) =>
                            setEmployeeTimes((prev) => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
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
                          value={employeeTimes[key]?.penalty || ""}
                          onChange={(e) =>
                            setEmployeeTimes((prev) => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                penalty: e.target.value,
                              },
                            }))
                          }
                          style={{ width: "80px" }}
                        />
                      </td>
                       
                      <td>{currentDelay}</td>
                      <td>{currentOvertime}</td>
                      <td>{calculateHours(currentClockIn, currentClockOut)}</td>
                      
                      <td>
                        <input 
                          type="checkbox"
                          checked={employeeTimes[key]?.absent || false}
                          onChange={(e) => {
                            const isAbsent = e.target.checked;
                            setEmployeeTimes(prev => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                absent: isAbsent,
                                clockIn: isAbsent ? "00:00" : prev[key]?.clockIn || "00:00",
                                clockOut: isAbsent ? "00:00" : prev[key]?.clockOut || "00:00",
                                _lastUpdate: Date.now()
                              }
                            }));
                            
                            // Save absent status to worktimeSync
                            const currentTimes = employeeTimes[key] || {};
                            saveWorktimeToLocalStorage(
                              emp.num, 
                              currentDate, 
                              currentTab, 
                              isAbsent ? "00:00" : currentTimes.clockIn || "00:00",
                              isAbsent ? "00:00" : currentTimes.clockOut || "00:00",
                              isAbsent,
                              currentTimes.absentComment || ""
                            );
                          }}
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          value={employeeTimes[key]?.absentComment || ""}
                          disabled={!employeeTimes[key]?.absent}
                          placeholder="Reason"
                          onChange={(e) =>
                            setEmployeeTimes(prev => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                absentComment: e.target.value
                              }
                            }))
                          }
                          onBlur={(e) => {
                            if (employeeTimes[key]?.absent && e.target.value.trim()) {
                              saveWorkTimeToDB(emp.num, "00:00", "00:00");
                              
                              // Update worktimeSync with comment
                              saveWorktimeToLocalStorage(
                                emp.num,
                                currentDate,
                                currentTab,
                                "00:00",
                                "00:00",
                                true,
                                e.target.value
                              );
                            }
                          }}
                          style={{ width: "150px" }}
                        />
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