import { useState, useEffect } from "react"; 
import { worktimeApi } from "../services/worktimeAPI.js";
import { shiftApi } from "../services/shfitAPI.js"; 
import { API_BASE_URL } from "../services/config";

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

  const [shifts, setShifts] = useState([]);
  const [currentTab, setCurrentTab] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newShift, setNewShift] = useState({ start_time: "", end_time: "" });
  const [editingShift, setEditingShift] = useState(null);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [manualInput, setManualInput] = useState({
    employee: null,
    type: null,
    value: ""
  });

  const [employeeTimes, setEmployeeTimes] = useState(() => {
    const savedTimes = loadFromLocalStorage('employeeTimes', {});
    return savedTimes;
  });

  const getCurrentDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  useEffect(() => {
    const loadTimesFromDB = async () => {
      if (!shifts.length || !employees.length) return;

      const currentDate = getCurrentDate();
      const times = {};

      for (const emp of employees) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/worktime/${emp.num}/${currentDate}`);
          if (!res.ok) continue;

          const data = await res.json();
          const workTimeRecords = Array.isArray(data) ? data : [data];

          workTimeRecords.forEach(record => {
            if (record && record.shift) {
              const key = `${emp.num}-${record.shift}`;
              times[key] = {
                clockIn: record.clockIn || "00:00",
                clockOut: record.clockOut || "00:00",
                workTimeId: record.id || null,
                consomation: record.consomation || 0,
                penalty: record.penalty || 0,
                absent: record.absent === 1 || record.absent === true,
                absentComment: record.absentComment || ""
              };
            }
          });
        } catch (err) {
          console.error(`Error loading time for employee ${emp.num}:`, err);
        }
      }

      // Merge DB times into state (DB is source of truth, localStorage overlays pending state)
      setEmployeeTimes(prev => {
        const merged = { ...prev };
        Object.entries(times).forEach(([key, val]) => {
          merged[key] = {
            ...merged[key],
            ...val,
            // Only override clockIn/clockOut from localStorage if they differ from DB
            clockIn: merged[key]?.clockIn && merged[key].clockIn !== "00:00"
              ? merged[key].clockIn
              : val.clockIn,
            clockOut: merged[key]?.clockOut && merged[key].clockOut !== "00:00"
              ? merged[key].clockOut
              : val.clockOut,
          };
        });
        return merged;
      });
    };

    loadTimesFromDB();
  }, [employees, shifts]);

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

  // Initialize employee times for all shifts
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

      return hasChanges ? updatedTimes : prev;
    });
  }, [employees, shifts]);

  const getShiftById = (shiftId) => {
    if (!shiftId || !shifts.length) return null;
    return shifts.find(s => s.shift_id === Number(shiftId)) || null;
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm("Are you sure you want to delete this shift?")) return;
    const deleted = await shiftApi.deleteShift(shiftId);
    if (!deleted) return;
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

  useEffect(() => {
    saveToLocalStorage('selectedShifts', selectedShifts);
  }, [selectedShifts]);

  useEffect(() => {
    saveToLocalStorage('employeeTimes', employeeTimes);
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
    if (clockIn === "00:00" || clockOut === "00:00") return "00:00";
    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    const [outHours, outMinutes] = clockOut.split(':').map(Number);
    const totalInMinutes = inHours * 60 + inMinutes;
    const totalOutMinutes = outHours * 60 + outMinutes;
    let diffMinutes = totalOutMinutes - totalInMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60;
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

  // ✅ FIXED: Always fetch latest consomation/penalty/absent from DB before saving,
  // so admin-entered values are never overwritten by stale local state.
  const saveWorkTimeToDB = async (employeeNum, clockIn, clockOut) => {
    try {
      const shiftNumber = currentTab;
      const lateMinutes = calculateLateMinutes(clockIn, shiftNumber);
      const overtimeMinutes = calculateOvertimeMinutes(clockOut, shiftNumber);
      const timeOfWork = calculateHours(clockIn, clockOut);
      const key = getEmployeeShiftKey(employeeNum, currentTab);

      // Start with whatever is in local state as fallback
      let freshConsomation = employeeTimes[key]?.consomation || 0;
      let freshPenalty = employeeTimes[key]?.penalty || 0;
      let freshAbsent = employeeTimes[key]?.absent ? 1 : 0;
      let freshAbsentComment = employeeTimes[key]?.absentComment || "";

      // Fetch the latest record from DB to get admin-entered values
      try {
        const currentDate = getCurrentDate();
        const res = await fetch(`${API_BASE_URL}/api/worktime/${employeeNum}/${currentDate}`);
        if (res.ok) {
          const data = await res.json();
          const records = Array.isArray(data) ? data : [data];
          const record = records.find(r => String(r.shift) === String(shiftNumber));
          if (record) {
            freshConsomation = record.consomation ?? freshConsomation;
            freshPenalty = record.penalty ?? freshPenalty;
            freshAbsent = record.absent ?? freshAbsent;
            freshAbsentComment = record.absentComment ?? freshAbsentComment;

            // Sync fresh DB values back into local state so UI stays accurate
            setEmployeeTimes(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                consomation: freshConsomation,
                penalty: freshPenalty,
                absent: freshAbsent === 1 || freshAbsent === true,
                absentComment: freshAbsentComment,
              }
            }));
          }
        }
      } catch (fetchErr) {
        console.warn('Could not fetch latest DB values before save, using local state:', fetchErr);
      }

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
        consomation: freshConsomation,     // ✅ from DB, not stale local state
        penalty: freshPenalty,             // ✅ from DB, not stale local state
        absent: freshAbsent,
        absentComment: freshAbsentComment
      };

      const savedWorkTime = await worktimeApi.saveWorkTime(workTimeData);

      setEmployeeTimes(prev => ({
        ...prev,
        [key]: { ...prev[key], workTimeId: savedWorkTime.id }
      }));

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
      clockIn: currentTime
    };

    setEmployeeTimes(prev => ({
      ...prev,
      [key]: updatedTimes
    }));

    // Save to DB with current clockOut (even if "00:00") so clockIn is persisted
    saveWorkTimeToDB(employeeNum, currentTime, updatedTimes.clockOut || "00:00");
  };

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
    } else {
      alert("Please clock in first before clocking out!");
    }
  };

  const clearLocalData = () => {
    localStorage.removeItem('employeeTimes');

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

  const getEmployeeTime = (employeeNum, type, shiftId = currentTab) => {
    const key = getEmployeeShiftKey(employeeNum, shiftId);
    return employeeTimes[key]?.[type] || "00:00";
  };

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
    return <div>There is no planning yet</div>;
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
            <button className="newDay" onClick={clearLocalData}>
              Clear local data
            </button>
          </div>

          <div style={{ marginLeft: "35px", marginTop: "20px" }}>
            <div style={{ marginLeft: "35px", marginTop: "20px" }}>

              {/* ADD + EDIT Shift Form */}
              {showAddForm && (
                <form
                  onSubmit={editingShift ? handleSubmitEditShift : handleSubmitShift}
                  style={{ display: "flex", gap: "10px", marginBottom: "20px" }}
                >
                  <input
                    type="time"
                    required
                    value={editingShift ? editingShift.start_time : newShift.start_time}
                    onChange={(e) => {
                      if (editingShift) {
                        setEditingShift({ ...editingShift, start_time: e.target.value });
                      } else {
                        setNewShift({ ...newShift, start_time: e.target.value });
                      }
                    }}
                  />
                  <input
                    type="time"
                    required
                    value={editingShift ? editingShift.end_time : newShift.end_time}
                    onChange={(e) => {
                      if (editingShift) {
                        setEditingShift({ ...editingShift, end_time: e.target.value });
                      } else {
                        setNewShift({ ...newShift, end_time: e.target.value });
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
                  <th>Employee</th>
                  <th>Clock in</th>
                  <th>Clock out</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const key = getEmployeeShiftKey(emp.num, currentTab);
                  const currentClockIn = getEmployeeTime(emp.num, 'clockIn', currentTab);
                  const currentClockOut = getEmployeeTime(emp.num, 'clockOut', currentTab);

                  return (
                    <tr
                      key={`${emp.num}-${currentTab}`}
                      style={{
                        backgroundColor: employeeTimes[key]?.absent ? '#f8f9fa' : 'transparent',
                        opacity: employeeTimes[key]?.absent ? 0.6 : 1,
                      }}
                    >
                      <td>{emp.FirstName}-{emp.empNumber}</td>

                      <td>
                        {!isAbsent(emp.num) && (
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
                            Clock In
                          </button>
                        )}
                        {isAbsent(emp.num) && (
                          <div style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
                            Absent
                          </div>
                        )}
                      </td>

                      <td>
                        {!isAbsent(emp.num) && (
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
                            Clock Out
                          </button>
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
                style={{ fontSize: "18px", padding: "6px", width: "140px", marginTop: "10px" }}
              />
              <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                <button
                  onClick={saveManualTime}
                  style={{ padding: "8px 12px", background: "#28a745", color: "white", borderRadius: "4px" }}
                >
                  Save
                </button>
                <button
                  onClick={() => setManualInput({ employee: null, type: null, value: "" })}
                  style={{ padding: "8px 12px", background: "#dc3545", color: "white", borderRadius: "4px" }}
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