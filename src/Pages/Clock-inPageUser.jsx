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

  // FETCH EMPLOYEES WITH CACHING - ONLY THOSE IN PLANNING
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
        // Get planning data first to know which employees are scheduled
        const planningData = await planningApi.getPlanning(currentDate);
        const scheduledEmployeeIds = new Set(planningData.map(p => p.emp_id));

        if (scheduledEmployeeIds.size === 0) {
          setEmployees([]);
          setLoading(false);
          return;
        }

        // Get all employees
        const employeesData = await employeesApi.getEmployees();

        // Filter only scheduled employees
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

  // LOAD EXISTING CLOCK IN/OUT TIMES FROM DATABASE AND LOCALSTORAGE FOR ALL SHIFTS
  useEffect(() => {
    const loadExistingTimes = async () => {
      if (!currentDate || employees.length === 0) return;

      try {
        const times = {};

        for (const emp of employees) {
          try {
            // First check localStorage for instant sync
            const localStorageKey = `worktime_${emp.num}_${currentDate}`;

            // Check all possible shift IDs in localStorage
            for (let shiftId = 1; shiftId <= 10; shiftId++) {
              const localKey = `${localStorageKey}_${shiftId}`;
              const localData = localStorage.getItem(localKey);

              if (localData) {
                try {
                  const parsed = JSON.parse(localData);
                  const key = `${emp.num}-${shiftId}`;
                  times[key] = {
                    clockIn: parsed.clockIn || "00:00",
                    clockOut: parsed.clockOut || "00:00",
                    absent: parsed.absent || false,
                    absentComment: parsed.absentComment || ""
                  };
                } catch (e) {
                  console.error('Error parsing localStorage data:', e);
                }
              }
            }

            // Then fetch from database as backup
            const res = await fetch(
              `${API_BASE_URL}/api/worktime/${emp.num}/${currentDate}`
            );

            if (res.ok) {
              const data = await res.json();

              // Check if data is an array (multiple shifts) or single object
              const workTimeRecords = Array.isArray(data) ? data : [data];

              // Store times for each shift this employee has worked (only if not already in localStorage)
              workTimeRecords.forEach(record => {
                if (record && record.shift) {
                  const key = `${emp.num}-${record.shift}`;
                  if (!times[key]) { // Only use database if not already loaded from localStorage
                    times[key] = {
                      clockIn: record.clockIn || "00:00",
                      clockOut: record.clockOut || "00:00",
                      absent: false,
                      absentComment: ""
                    };
                  }
                }
              });
            }
          } catch (err) {
            console.error(`Error loading time for employee ${emp.num}:`, err);
          }
        }

        setEmployeeTimes(times);
      } catch (err) {
        console.error("Error loading existing times:", err);
      }
    };

    loadExistingTimes();

    // Listen for storage changes from other tabs/windows (cross-tab sync)
    const handleStorageChange = (e) => {
      console.log('🎧 USER VIEW: Storage event fired', e.key);
      // Only update if worktime data changed
      if (e.key && e.key.startsWith('worktime_')) {
        console.log('📡 USER VIEW: Storage changed from another tab, updating state smoothly...');
        // Just update state, don't reload everything
        const localStorageTimes = loadAllWorktimeForDate(currentDate);
        setEmployeeTimes(prev => {
          console.log('🔄 USER VIEW: Updating employeeTimes from', prev, 'to', localStorageTimes);
          return {
            ...prev,
            ...localStorageTimes
          };
        });
      }
    };

    // Listen for custom events from same page (same-tab sync)
    const handleWorktimeUpdate = (e) => {
      console.log('🎧 USER VIEW: Custom event fired', e.detail);
      console.log('🔥 USER VIEW: Worktime updated event received, updating state smoothly...');
      // Just update state, don't reload everything
      const localStorageTimes = loadAllWorktimeForDate(currentDate);
      setEmployeeTimes(prev => {
        console.log('🔄 USER VIEW: Updating employeeTimes from', prev, 'to', localStorageTimes);
        return {
          ...prev,
          ...localStorageTimes
        };
      });
    };

    // Listen for simple event too
    const handleWorktimeChanged = (e) => {
      console.log('🎧 USER VIEW: Simple worktime-changed event fired');
      const localStorageTimes = loadAllWorktimeForDate(currentDate);
      setEmployeeTimes(prev => ({
        ...prev,
        ...localStorageTimes
      }));
    };

    console.log('👂 USER VIEW: Adding event listeners');
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('worktimeUpdated', handleWorktimeUpdate);
    window.addEventListener('worktime-changed', handleWorktimeChanged);

    return () => {
      console.log('🔇 USER VIEW: Removing event listeners');
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('worktimeUpdated', handleWorktimeUpdate);
      window.removeEventListener('worktime-changed', handleWorktimeChanged);
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

  // GET CURRENT TIME
  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // CALCULATE LATE MINUTES
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

  // CALCULATE OVERTIME MINUTES
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

  // FORMAT MINUTES TO TIME
  const formatMinutesToTime = (totalMinutes) => {
    if (totalMinutes <= 0) return "00:00";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // CALCULATE HOURS
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

  // CLOCK IN HANDLER - FIXED
  const handleClockIn = async (emp) => {
    try {
      console.log('🕐 Starting clock-in for:', emp.FirstName);
      
      const clockInTime = getCurrentTime();
      const shiftDetails = getShiftById(currentTab);

      if (!shiftDetails) {
        console.error('❌ No shift details found for tab:', currentTab);
        alert('Shift details not found. Please refresh the page.');
        return;
      }

      console.log('📋 Shift details:', shiftDetails);

      // Update local state IMMEDIATELY to show button color change
      const key = `${emp.num}-${currentTab}`;
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

      // ✅ FIXED: Send only what backend expects (no clockIn/clockOut)
      const workTimeData = {
        employeeId: emp.num,
        date: currentDate,
        timeOfWork: "00:00",
        shift: shiftDetails.shift_id,
        delay: formatMinutesToTime(lateMinutes),
        overtime: "00:00",
        consomation: 0,
        penalty: 0,
        absent: 0,
        absentComment: ""
      };

      console.log('📤 Sending worktime data:', workTimeData);
      await worktimeApi.saveWorkTime(workTimeData);
      console.log('✅ API Response: Success');

      // Save to localStorage using utility function (triggers sync)
      saveWorktimeToLocalStorage(emp.num, currentDate, shiftDetails.shift_id, clockInTime, "00:00");

      // Clear employee cache
      clearEmployeeCache(currentDate);

      console.log(`✅ Clock in saved for employee ${emp.num}`);

    } catch (err) {
      console.error('❌ Clock-in error:', err);
      alert(`Clock-in failed: ${err.message}`);
      
      // Revert button state on error
      const key = `${emp.num}-${currentTab}`;
      setEmployeeTimes(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          clockIn: "00:00"
        }
      }));
    }
  };

  // CLOCK OUT HANDLER - FIXED
  const handleClockOut = async (emp) => {
    try {
      console.log('🕐 Starting clock-out for:', emp.FirstName);
      
      const clockOutTime = getCurrentTime();
      const shiftDetails = getShiftById(currentTab);

      if (!shiftDetails) {
        console.error('❌ No shift details found for tab:', currentTab);
        alert('Shift details not found. Please refresh the page.');
        return;
      }

      const key = `${emp.num}-${currentTab}`;

      // Get the clockIn time from current state
      const clockInTime = employeeTimes[key]?.clockIn || "00:00";

      if (clockInTime === "00:00") {
        alert("Please clock in first before clocking out!");
        return;
      }

      console.log('📋 Clock in time:', clockInTime);
      console.log('📋 Clock out time:', clockOutTime);

      // Update local state IMMEDIATELY to show button color change
      setEmployeeTimes(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          clockOut: clockOutTime
        }
      }));

      const customTimes = await getCustomShiftTimes(emp.num, shiftDetails.shift_id);
      const effectiveEndTime = customTimes?.end_time || shiftDetails.end_time;

      const timeOfWork = calculateHours(clockInTime, clockOutTime);
      const overtimeMinutes = calculateOvertimeMinutes(clockOutTime, effectiveEndTime);
      const effectiveStartTime = customTimes?.start_time || shiftDetails.start_time;
      const lateMinutes = calculateLateMinutes(clockInTime, effectiveStartTime);

      console.log('⏱️ Time of work:', timeOfWork);
      console.log('⏰ Late minutes:', lateMinutes);
      console.log('⏰ Overtime minutes:', overtimeMinutes);

      // ✅ FIXED: Send only what backend expects (no clockIn/clockOut)
      const workTimeData = {
        employeeId: emp.num,
        date: currentDate,
        timeOfWork: timeOfWork,
        shift: shiftDetails.shift_id,
        delay: formatMinutesToTime(lateMinutes),
        overtime: formatMinutesToTime(overtimeMinutes),
        consomation: 0,
        penalty: 0,
        absent: 0,
        absentComment: ""
      };

      console.log('📤 Sending worktime data:', workTimeData);
      await worktimeApi.saveWorkTime(workTimeData);
      console.log('✅ API Response: Success');

      // Save to localStorage using utility function (triggers sync)
      saveWorktimeToLocalStorage(emp.num, currentDate, shiftDetails.shift_id, clockInTime, clockOutTime);

      // Clear employee cache
      clearEmployeeCache(currentDate);

      console.log(`✅ Clock out saved for employee ${emp.num}`);

    } catch (err) {
      console.error('❌ Clock-out error:', err);
      alert(`Clock-out failed: ${err.message}`);
      
      // Revert button state on error
      const key = `${emp.num}-${currentTab}`;
      setEmployeeTimes(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          clockOut: "00:00"
        }
      }));
    }
  };

  // GET BUTTON STYLE BASED ON CLOCK STATUS
  const getClockInButtonStyle = (emp) => {
    const key = `${emp.num}-${currentTab}`;
    const clockIn = employeeTimes[key]?.clockIn;

    if (clockIn && clockIn !== "00:00") {
      return {
        background: '#28a745', // Green when clocked in
        color: 'white',
        border: 'none',
        padding: '20px 20px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        width: '100%'
      };
    }

    return {
      background: '#6c757d', // Gray when not clocked in
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

    if (clockOut && clockOut !== "00:00") {
      return {
        background: '#dc3545', // Red when clocked out
        color: 'white',
        border: 'none',
        padding: '20px 20px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        width: '100%'
      };
    }

    return {
      background: '#6c757d', // Gray when not clocked out
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
        <div>There is no planning yet...</div>
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