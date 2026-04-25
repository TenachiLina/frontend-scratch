import '../App.css'
import Header from "../AuthContext/HeaderUser"
import { useState, useEffect } from "react";
import { employeesApi } from "../services/employeesAPI";
import { worktimeApi } from "../services/worktimeAPI";
import { shiftApi } from "../services/shfitAPI";
import { planningApi } from "../services/planningAPI";
import { API_BASE_URL } from "../services/config";
import {
  saveWorktimeToLocalStorage,
  loadAllWorktimeForDate,
  clearEmployeeCache
} from "../services/worktimeSync";

function ClockInOutUser() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [employeeShifts, setEmployeeShifts] = useState({});
  const [selectedShiftsForDate, setSelectedShiftsForDate] = useState([]);
  const [currentTab, setCurrentTab] = useState(null);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [employeeTimes, setEmployeeTimes] = useState({});

  // GET CURRENT DATE
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

  // FORMAT DATE FOR DISPLAY
  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // LOAD SHIFTS THAT ARE USED IN PLANNING FOR TODAY
  useEffect(() => {
    const loadSelectedShiftsForDate = async () => {
      if (!currentDate) return;

      try {
        const planningData = await planningApi.getPlanning(currentDate);

        const usedShiftIds = new Set();
        planningData.forEach(assignment => {
          if (assignment.shift_id) {
            usedShiftIds.add(assignment.shift_id);
          }
        });

        const allShifts = await shiftApi.getShifts();

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

        if (shiftsForDate.length > 0) {
          setCurrentTab(shiftsForDate[0].shift_id);
        }
      } catch (err) {
        console.error("Error loading shifts for date:", err);
        setSelectedShiftsForDate([]);
      }
    };

    loadSelectedShiftsForDate();
  }, [currentDate]);

  // FETCH EMPLOYEES - ONLY THOSE IN PLANNING
  useEffect(() => {
    if (!currentDate) return;

    const cacheKey = `employees_${currentDate}`;

    const fetchEmployees = async () => {
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          setEmployees(parsedCache);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Cache parse error:', e);
          localStorage.removeItem(cacheKey);
        }
      }

      setLoading(true);
      try {
        const planningData = await planningApi.getPlanning(currentDate);
        const scheduledEmployeeIds = new Set(planningData.map(p => p.emp_id));

        if (scheduledEmployeeIds.size === 0) {
          setEmployees([]);
          setLoading(false);
          return;
        }

        const employeesData = await employeesApi.getEmployees();

        const transformedEmployees = employeesData
          .filter(emp => scheduledEmployeeIds.has(emp.emp_id))
          .map(emp => ({
            empNumber: emp.emp_number,
            num: emp.emp_id,
            FirstName: emp.FirstName,
            LastName: emp.LastName,
            clockIn: "00:00",
            clockOut: "00:00",
            shift: 0,
          }));

        setEmployees(transformedEmployees);
        localStorage.setItem(cacheKey, JSON.stringify(transformedEmployees));
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

  // LOAD ALL SHIFTS FOR EACH EMPLOYEE FROM PLANNING
  useEffect(() => {
    const loadShifts = async () => {
      if (!currentDate || employees.length === 0) return;

      try {
        const updatedShifts = await employees.reduce(async (accPromise, emp) => {
          const acc = await accPromise;

          const res = await fetch(
            `${API_BASE_URL}/api/planning/employee-shifts-all/${emp.num}/${currentDate}`
          );
          if (!res.ok) return acc;

          const data = await res.json();

          const shiftIds = data
            .map(shift => shift.shift_id ? shift.shift_id.toString() : null)
            .filter(id => id !== null);

          acc[emp.num] = shiftIds;

          return acc;
        }, Promise.resolve({}));

        setEmployeeShifts(updatedShifts);
      } catch (err) {
        console.error("Error fetching shifts:", err);
        setEmployeeShifts({});
      }
    };

    loadShifts();
  }, [currentDate, employees]);

  // FIX 1: Use correct route GET /api/worktime/date/:date (not /api/worktime/:emp/:date which doesn't exist)
  // FIX 2: Backend returns snake_case — clock_in, clock_out, shift_id, absent_comment
  const loadExistingTimes = async () => {
    if (!currentDate || employees.length === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/worktime/date/${currentDate}`);
      if (!res.ok) return;
      const records = await res.json();
      if (!Array.isArray(records) || records.length === 0) return;

      const times = {};
      records.forEach(record => {
        // snake_case from DB: emp_id, shift_id, clock_in, clock_out, absent_comment
        const key = `${record.emp_id}-${record.shift_id}`;
        times[key] = {
          clockIn: record.clock_in?.slice(0, 5) || "00:00",
          clockOut: record.clock_out?.slice(0, 5) || "00:00",
          absent: record.absent === 1 || record.absent === true,
          absentComment: record.absent_comment || ""
        };
      });

      setEmployeeTimes(prev => ({ ...prev, ...times }));
    } catch (err) {
      console.error("Error loading existing times:", err);
    }
  };

  useEffect(() => {
    if (!currentDate || employees.length === 0) return;

    loadExistingTimes();

    // Poll every 30s — picks up clock-ins made on another PC
    const interval = setInterval(loadExistingTimes, 30000);

    // Same-browser tab sync via storage events
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('worktime_')) loadExistingTimes();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('worktime-changed', loadExistingTimes);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('worktime-changed', loadExistingTimes);
    };
  }, [currentDate, employees]);

  // FILTER EMPLOYEES BY CURRENT TAB
  useEffect(() => {
    if (!currentTab) {
      setFilteredEmployees([]);
      return;
    }

    const current = String(currentTab);
    const newFiltered = employees.filter((emp) => {
      const assignedShifts = employeeShifts[emp.num];
      if (!assignedShifts) return false;
      return Array.isArray(assignedShifts)
        ? assignedShifts.map(String).includes(current)
        : String(assignedShifts) === current;
    });

    setFilteredEmployees(newFiltered);
  }, [currentTab, employees, employeeShifts]);

  // GET SHIFT DETAILS
  const getShiftById = (shiftId) => {
    if (!shiftId || !selectedShiftsForDate.length) return null;
    return selectedShiftsForDate.find(s => s.shift_id === Number(shiftId)) || null;
  };

  // GET CUSTOM SHIFT TIMES FROM PLANNING
  const getCustomShiftTimes = async (empNum, shiftId) => {
    try {
      const planningData = await planningApi.getPlanning(currentDate);
      const assignment = planningData.find(
        p => p.emp_id === empNum && p.shift_id === shiftId
      );

      if (assignment && (assignment.custom_start_time || assignment.custom_end_time)) {
        return {
          start_time: assignment.custom_start_time || null,
          end_time: assignment.custom_end_time || null
        };
      }
      return null;
    } catch (err) {
      console.error("Error getting custom shift times:", err);
      return null;
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const calculateLateMinutes = (clockIn, shiftStart) => {
    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };
    const clockInM = toMinutes(clockIn);
    let shiftStartM = toMinutes(shiftStart);
    if (clockInM < shiftStartM) shiftStartM -= 24 * 60;
    const late = clockInM - shiftStartM;
    return late > 0 ? late : 0;
  };

  const calculateOvertimeMinutes = (clockOut, shiftEnd) => {
    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };
    let clockOutM = toMinutes(clockOut);
    let shiftEndM = toMinutes(shiftEnd);
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

  // ✅ FIXED: CLOCK IN - now includes clockIn field in DB payload
  const handleClockIn = async (emp) => {
    try {
      const clockInTime = getCurrentTime();
      const shiftDetails = getShiftById(currentTab);

      if (!shiftDetails) {
        alert('Shift details not found. Please refresh the page.');
        return;
      }

      const key = `${emp.num}-${currentTab}`;

      // Update UI immediately
      setEmployeeTimes(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          clockIn: clockInTime
        }
      }));

      const customTimes = await getCustomShiftTimes(emp.num, shiftDetails.shift_id);
      const effectiveStartTime = customTimes?.start_time || shiftDetails.start_time;
      const lateMinutes = calculateLateMinutes(clockInTime, effectiveStartTime);

      // ✅ Include clockIn in payload
      const workTimeData = {
        employeeId: emp.num,
        date: currentDate,
        clockIn: clockInTime,
        clockOut: "00:00",
        timeOfWork: "00:00",
        shift: shiftDetails.shift_id,
        delay: formatMinutesToTime(lateMinutes),
        overtime: "00:00",
        consomation: 0,
        penalty: 0,
        absent: 0,
        absentComment: ""
      };

      await worktimeApi.saveWorkTime(workTimeData);

      // Save to localStorage for cross-tab sync
      saveWorktimeToLocalStorage(emp.num, currentDate, shiftDetails.shift_id, clockInTime, "00:00");
      clearEmployeeCache(currentDate);

    } catch (err) {
      console.error('❌ Clock-in error:', err);
      alert(`Clock-in failed: ${err.message}`);

      // Revert UI on error
      const key = `${emp.num}-${currentTab}`;
      setEmployeeTimes(prev => ({
        ...prev,
        [key]: { ...prev[key], clockIn: "00:00" }
      }));
    }
  };

  // ✅ FIXED: CLOCK OUT - now includes both clockIn and clockOut in DB payload
  const handleClockOut = async (emp) => {
    try {
      const clockOutTime = getCurrentTime();
      const shiftDetails = getShiftById(currentTab);

      if (!shiftDetails) {
        alert('Shift details not found. Please refresh the page.');
        return;
      }

      const key = `${emp.num}-${currentTab}`;
      const clockInTime = employeeTimes[key]?.clockIn || "00:00";

      if (clockInTime === "00:00") {
        alert("Please clock in first before clocking out!");
        return;
      }

      // Update UI immediately
      setEmployeeTimes(prev => ({
        ...prev,
        [key]: { ...prev[key], clockOut: clockOutTime }
      }));

      const customTimes = await getCustomShiftTimes(emp.num, shiftDetails.shift_id);
      const effectiveEndTime = customTimes?.end_time || shiftDetails.end_time;
      const effectiveStartTime = customTimes?.start_time || shiftDetails.start_time;

      const timeOfWork = calculateHours(clockInTime, clockOutTime);
      const overtimeMinutes = calculateOvertimeMinutes(clockOutTime, effectiveEndTime);
      const lateMinutes = calculateLateMinutes(clockInTime, effectiveStartTime);

      // ✅ Include both clockIn and clockOut in payload
      const workTimeData = {
        employeeId: emp.num,
        date: currentDate,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        timeOfWork: timeOfWork,
        shift: shiftDetails.shift_id,
        delay: formatMinutesToTime(lateMinutes),
        overtime: formatMinutesToTime(overtimeMinutes),
        consomation: 0,
        penalty: 0,
        absent: 0,
        absentComment: ""
      };

      await worktimeApi.saveWorkTime(workTimeData);

      // Save to localStorage for cross-tab sync
      saveWorktimeToLocalStorage(emp.num, currentDate, shiftDetails.shift_id, clockInTime, clockOutTime);
      clearEmployeeCache(currentDate);

    } catch (err) {
      console.error('❌ Clock-out error:', err);
      alert(`Clock-out failed: ${err.message}`);

      // Revert UI on error
      const key = `${emp.num}-${currentTab}`;
      setEmployeeTimes(prev => ({
        ...prev,
        [key]: { ...prev[key], clockOut: "00:00" }
      }));
    }
  };

  // ✅ BUTTON STYLES + show recorded time on button label
  const getClockInButtonStyle = (emp) => {
    const key = `${emp.num}-${currentTab}`;
    const clockIn = employeeTimes[key]?.clockIn;
    const clocked = clockIn && clockIn !== "00:00";
    return {
      background: clocked ? '#28a745' : '#6c757d',
      color: 'white',
      border: 'none',
      padding: '20px 20px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      width: '100%'
    };
  };

  const getClockOutButtonStyle = (emp) => {
    const key = `${emp.num}-${currentTab}`;
    const clockOut = employeeTimes[key]?.clockOut;
    const clocked = clockOut && clockOut !== "00:00";
    return {
      background: clocked ? '#dc3545' : '#6c757d',
      color: 'white',
      border: 'none',
      padding: '20px 20px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      width: '100%'
    };
  };

  if (loading) {
    return (
      <>
        <Header />
        <div>Loading...</div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div>Error: {error}</div>
      </>
    );
  }

  if (!currentTab) {
    return (
      <>
        <Header />
        <div>There is no planning yet</div>
      </>
    );
  }

  return (
    <>
      <Header />

      {(!selectedShiftsForDate.length || currentTab === null) ? (
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
            Today is {formatDateDisplay(currentDate)}
          </div>

          <div style={{ marginLeft: "35px", marginTop: "20px" }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              {selectedShiftsForDate.map((shift) => (
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
                  Shift ({shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)})
                </button>
              ))}
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
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                      No employees scheduled for this shift
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const key = `${emp.num}-${currentTab}`;
                    const isAbsent = employeeTimes[key]?.absent || false;
                    // ✅ Read actual times from state (loaded from DB on mount)
                    const clockIn = employeeTimes[key]?.clockIn || "00:00";
                    const clockOut = employeeTimes[key]?.clockOut || "00:00";

                    return (
                      <tr key={key}>
                        <td>{emp.FirstName} - {emp.empNumber}</td>

                        <td>
                          {isAbsent ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '20px',
                              color: '#6c757d',
                              fontStyle: 'italic',
                              background: '#f8f9fa',
                              borderRadius: '4px'
                            }}>
                              Absent
                            </div>
                          ) : (
                            <button
                              className="time-button"
                              onClick={() => handleClockIn(emp)}
                              style={getClockInButtonStyle(emp)}
                            >
                              Clock In
                            </button>
                          )}
                        </td>

                        <td>
                          {isAbsent ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '20px',
                              color: '#6c757d',
                              fontStyle: 'italic',
                              background: '#f8f9fa',
                              borderRadius: '4px'
                            }}>
                              Absent
                            </div>
                          ) : (
                            <button
                              className="time-button"
                              onClick={() => handleClockOut(emp)}
                              style={getClockOutButtonStyle(emp)}
                            >
                              Clock Out
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default ClockInOutUser;