import Header from "../Components/Header"
import DropDownList from "../Components/DropDownList"
import "../index.css"
import { useState, useEffect, useRef } from "react"
import ShiftsDropDownList from "../Components/ShiftDropDownList"
import { employeesApi } from "../services/employeesAPI"
import { planningApi } from "../services/planningAPI"
import { shiftApi } from '../services/shfitAPI.js'; // adjust the path to match your project
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";




// ---------- Module-level session cache & in-flight tracker ----------
let employeesCache = null;
let employeesCachePromise = null;
// -------------------------------------------------------------------

export default function Planning() {
    const getWeekDates = () => {
        const dates = [];
        const today = new Date();
        const currentDay = today.getDay(); // 0=Sun, 6=Sat

        // last Saturday
        const saturday = new Date(today);
        const diff = (currentDay + 1) % 7;
        saturday.setDate(today.getDate() - diff);

        for (let i = 0; i < 7; i++) {
            const date = new Date(saturday);
            date.setDate(saturday.getDate() + i);

            const localDate = new Date(
                date.getTime() - date.getTimezoneOffset() * 60000
            )
                .toISOString()
                .split("T")[0];

            dates.push(localDate);
        }

        return dates;
    };



    const [weekDates, setWeekDates] = useState(getWeekDates());

    //NEWWWWWWWWWWWWWWWWW
    // Returns the index of today's date inside the week array
    const getTodayIndex = (week) => {
        const now = new Date();
        const localToday = new Date(
            now.getTime() - now.getTimezoneOffset() * 60000
        )
            .toISOString()
            .split("T")[0];

        return week.indexOf(localToday);
    };


    const [isOpen, setIsOpen] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    //NEWWWW
    const [savingWeek, setSavingWeek] = useState(false);
    const [loadingPlanning, setLoadingPlanning] = useState(false);
    // const [activeTab, setActiveTab] = useState(0);
    const [activeTab, setActiveTab] = useState(() => {
        const idx = getTodayIndex(weekDates);
        return idx !== -1 ? idx : 0;
    });

    const [assignments, setAssignments] = useState({});

    const [copiedDay, setCopiedDay] = useState(null);
    const [tick, setTick] = useState(0);

    const [hoveredEmployee, setHoveredEmployee] = useState(null);
    const [dropdownVisibleFor, setDropdownVisibleFor] = useState(null);


    const planningDataRefs = useRef({});
    const existingPlannings = useRef({});

    //Newwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
    const [copiedWeek, setCopiedWeek] = useState(null);


    const posts = [
        { id: 1, name: "Pizzaiolo" },
        { id: 2, name: "Livreur" },
        { id: 3, name: "Agent polyvalent" },
        { id: 4, name: "Prepateur" },
        { id: 5, name: "Cassier" },
        { id: 6, name: "Serveur" },
        { id: 7, name: "Plongeur" },
        { id: 8, name: "Manageur" },
        { id: 9, name: "Packaging" },
        { id: 10, name: "Topping" },
        { id: 11, name: "Bar" },
        { id: 12, name: "Pate" }
    ];

    const [shifts, setShifts] = useState([]);


    const dayNames = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const getCurrentDate = () => weekDates[activeTab];

    const formatDateDisplay = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    };

    // ------------------ CACHED EMPLOYEES EFFECT ------------------
    useEffect(() => {
        let isMounted = true;

        const transform = (employeesData) => employeesData.map(emp => ({
            FirstName: emp.FirstName,
            LastName: emp.LastName,
            emp_id: emp.emp_id || emp.id
        }));

        const useCached = (cached) => {
            if (!isMounted) return;
            setEmployees(cached);
            setLoading(false);
        };

        const fetchAndCache = async () => {
            try {
                setLoading(true);

                // If there is already an in-flight promise, await it
                if (employeesCachePromise) {
                    const cached = await employeesCachePromise;
                    if (cached && isMounted) {
                        useCached(cached);
                    }
                    return;
                }

                // Start the fetch and save the promise so another mount waits for it
                employeesCachePromise = (async () => {
                    try {
                        const employeesData = await planningApi.getEmployees();
                        const transformed = transform(employeesData || []);
                        // store in cache
                        employeesCache = transformed;
                        return transformed;
                    } catch (err) {
                        // ensure we don't store a broken cache
                        employeesCache = null;
                        throw err;
                    } finally {
                        // don't clear employeesCachePromise here; keep it so subsequent mounts can await completed promise
                    }
                })();

                const result = await employeesCachePromise;
                if (isMounted) {
                    useCached(result);
                }
            } catch (err) {
                console.error("❌ Error fetching employees:", err);
                if (isMounted) {
                    setEmployees([]);
                    setError(err);
                    setLoading(false);
                }
            }
        };

        // If cache exists already, use it immediately (fast)
        if (employeesCache) {
            useCached(employeesCache);
        } else {
            fetchAndCache();
        }

        return () => {
            isMounted = false;
        };
    }, []);
    // -------------------------------------------------------------

    useEffect(() => {
        if (employees.length > 0) {
            loadExistingPlanningForTab(activeTab);
        }
    }, [activeTab, employees]);

    //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
    useEffect(() => {
        if (!weekDates || weekDates.length === 0) return;

        const idx = getTodayIndex(weekDates);
        setActiveTab(idx !== -1 ? idx : 0);
    }, [weekDates]);

    
    useEffect(() => {
        const loadShifts = async () => {
            try {
                const data = await shiftApi.getShifts(); // fetch from backend
                console.log("💾 Shifts data from API:", data);
                const formattedShifts = data.map((s, index) => ({
                    id: s.shift_id, // must match DB
                    name: `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)} (${index + 1})`,
                    time: `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}` // optional if needed
                }));

                setShifts(formattedShifts);
                console.log("💾 Loaded shifts:", formattedShifts); // debug
            } catch (err) {
                console.error("Failed to fetch shifts:", err);
            }
        };

        loadShifts();
    }, []);

    const loadExistingPlanningForTab = async (tabIndex) => {
        const date = weekDates[tabIndex];
        try {
            setLoadingPlanning(true);
            const planningData = await planningApi.getPlanning(date);
            existingPlannings.current[date] = planningData;

            if (!planningDataRefs.current[date]) {
                planningDataRefs.current[date] = {};
            }

            planningData.forEach((assignment) => {
                const key = `${assignment.task_id}-${assignment.shift_id}`;

                if (!Array.isArray(planningDataRefs.current[date][key])) {
                    planningDataRefs.current[date][key] = [];
                }

                const alreadyExists = planningDataRefs.current[date][key].some(
                    (emp) => emp.emp_id === assignment.emp_id
                );

                if (!alreadyExists) {
                    planningDataRefs.current[date][key].push({
                        emp_id: assignment.emp_id,
                        employee_FirstName: assignment.employee_FirstName,
                        employee_LastName: assignment.employee_LastName,
                        // employee_name: assignment.employee_name,
                        task_id: assignment.task_id,
                        shift_id: assignment.shift_id,
                        plan_date: date,
                    });
                }
            });

        } catch (error) {
            console.error(`❌ Error loading planning for ${date}:`, error);
            existingPlannings.current[date] = [];
            if (!planningDataRefs.current[date]) {
                planningDataRefs.current[date] = {};
            }
        } finally {
            setLoadingPlanning(false);
        }
    };


    const getFallbackEmployees = () => [
        { name: "Akram Dib", emp_id: 1 },
        { name: "Alaa krem", emp_id: 2 },
    ];

    const handleEmployeeSelect = (postId, shiftId, employee, date) => {
        const key = `${postId}-${shiftId}`;
        if (!planningDataRefs.current[date]) {
            planningDataRefs.current[date] = {};
        }

        if (!Array.isArray(planningDataRefs.current[date][key])) {
            planningDataRefs.current[date][key] = [];
        }

        const currentEmployees = planningDataRefs.current[date][key];

        const alreadyExists = currentEmployees.some(e => e.emp_id === employee.emp_id);

        if (!alreadyExists) {
            currentEmployees.push({
                shift_id: shiftId,
                emp_id: employee.emp_id,
                task_id: postId,
                plan_date: date,
                // employee_name: employee.name
                employee_FirstName: employee.FirstName,
                employee_LastName: employee.LastName
            });
           
        }
    };

    const getSelectedEmployee = (postId, shiftId, date) => {
        if (!planningDataRefs.current[date]) return [];

        const key = `${postId}-${shiftId}`;
        const entry = planningDataRefs.current[date][key];

        if (!entry) return [];

        if (Array.isArray(entry)) {
            return entry.map(e => ({
                emp_id: e.emp_id,
                // name: e.employee_name || employees.find(emp => emp.emp_id === e.emp_id)?.name || "Unknown"
                FirstName: e.employee_FirstName || employees.find(emp => emp.emp_id === e.emp_id)?.FirstName || "Unknown",
                LastName: e.employee_LastName || employees.find(emp => emp.emp_id === e.emp_id)?.LastName || ""
            }));
        }

        if (entry.emp_id) {
            return [{
                emp_id: entry.emp_id,
                // name: entry.employee_name || employees.find(emp => emp.emp_id === entry.emp_id)?.name || "Unknown"
                FirstName: e.employee_FirstName || employees.find(emp => emp.emp_id === e.emp_id)?.FirstName || "Unknown",
                LastName: e.employee_LastName || employees.find(emp => emp.emp_id === e.emp_id)?.LastName || ""
            }];
        }

        return [];
    };

    const savePlanning = async (date, silent = false) => {
        const currentDate = date;

        try {
            if (!silent) setSaving(true);

            const dayData = planningDataRefs.current?.[currentDate] || {};
            const planningArray = [];

            Object.entries(dayData).forEach(([key, employees]) => {
                if (!employees) return;

                const [postId, shiftId] = key.split('-');

                if (Array.isArray(employees)) {
                    employees.forEach(emp => {
                        if (emp?.emp_id) {
                            planningArray.push({
                                shift_id: parseInt(shiftId),
                                emp_id: emp.emp_id,
                                task_id: parseInt(postId),
                                plan_date: currentDate,
                            });
                        }
                    });
                } else if (employees.emp_id) {
                    planningArray.push({
                        shift_id: parseInt(shiftId),
                        emp_id: employees.emp_id,
                        task_id: parseInt(postId),
                        plan_date: currentDate,
                    });
                }
            });

            // On supprime l'alerte si planningArray est vide
            // et on envoie quand même la requête pour "vider" la planification
            console.log("Sending planningData:", planningArray);


            await planningApi.savePlanning({
                plan_date: currentDate,
                assignments: planningArray, // peut être vide
            });

            if (!silent) {
                alert(`Planning for ${formatDateDisplay(currentDate)} saved!`);
            }

            await loadExistingPlanningForTab(activeTab);

        } catch (err) {
            console.error(err);
            if (!silent) alert(err.message);
        } finally {
            if (!silent) setSaving(false);
        }
    };




    const saveAllPlanning = async () => {
        try {
            setSaving(true);
            let totalSaved = 0;

            for (const date of weekDates) {
                const planningArray = [];

                if (planningDataRefs.current?.[date]) {
                    Object.entries(planningDataRefs.current[date]).forEach(([key, item]) => {
                        if (!item) return;

                        if (Array.isArray(item)) {
                            item.forEach(emp => {
                                if (emp?.emp_id) {
                                    planningArray.push({
                                        shift_id: emp.shift_id,
                                        emp_id: emp.emp_id,
                                        task_id: emp.task_id,
                                        plan_date: date
                                    });
                                }
                            });
                        } else if (item.emp_id) {
                            planningArray.push({
                                shift_id: item.shift_id,
                                emp_id: item.emp_id,
                                task_id: item.task_id,
                                plan_date: date
                            });
                        }
                    });
                }

                if (planningArray.length > 0) {
                    await planningApi.savePlanning({
                        plan_date: date,
                        assignments: planningArray
                    });

                    totalSaved += planningArray.length;
                }
            }

            alert(`✅ All planning saved successfully! Total assignments: ${totalSaved}`);

        } catch (error) {
            console.error('❌ Error saving all planning:', error);
            alert('Error saving planning: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const copyDay = () => {
        const date = getCurrentDate();

        const dayPlanning = planningDataRefs.current[date];

        if (!dayPlanning || Object.keys(dayPlanning).length === 0) {
            alert("No planning to copy for this date!");
            return;
        }

        const filteredEntries = Object.entries(dayPlanning).filter(
            ([k, v]) => Array.isArray(v) && v.some(emp => emp.emp_id)
        );

        const filtered = Object.fromEntries(filteredEntries);

        if (Object.keys(filtered).length === 0) {
            alert("No affected employees to copy!");
            return;
        }

        setCopiedDay(JSON.parse(JSON.stringify(filtered)));
        alert(`Planning for ${formatDateDisplay(date)} copied successfully!`);
    };
    //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
    const copyWeek = () => {
        if (!weekDates || weekDates.length === 0) {
            alert("No week to copy!");
            return;
        }

        const weekPlanning = {};

        weekDates.forEach(date => {
            // si la journée est vide, on met quand même un objet vide
            weekPlanning[date] = planningDataRefs.current[date]
                ? JSON.parse(JSON.stringify(planningDataRefs.current[date]))
                : {};
        });

        setCopiedWeek(weekPlanning);
        alert("✅ Week planning copied successfully!");
    };


    const pasteDay = () => {
        const date = getCurrentDate();

        if (!copiedDay) {
            alert("No day copied yet!");
            return;
        }

        if (!planningDataRefs.current[date]) planningDataRefs.current[date] = {};

        planningDataRefs.current[date] = JSON.parse(JSON.stringify(copiedDay));

        setTick(t => t + 1);

        alert(`✅ Copied planning pasted to ${formatDateDisplay(date)}!`);
    };
    //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
    const pasteWeek = () => {
        if (!copiedWeek) {
            alert("No week copied yet!");
            return;
        }

        if (!weekDates || weekDates.length === 0) return;

        weekDates.forEach((date, idx) => {
            const copiedDate = Object.keys(copiedWeek)[idx];

            // On colle même si la journée est vide
            planningDataRefs.current[date] = copiedWeek[copiedDate]
                ? JSON.parse(JSON.stringify(copiedWeek[copiedDate]))
                : {};
        });

        setTick(t => t + 1); // forcer le rerender
        alert("✅ Copied week planning pasted successfully!");
    };



    const navigateWeek = (direction) => {
        const newWeekDates = weekDates.map(date => {
            const d = new Date(date);
            d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
            return d.toISOString().split("T")[0];
        });

        setWeekDates(newWeekDates);

        // Auto-select today's tab if inside this new week
        const idx = getTodayIndex(newWeekDates);
        setActiveTab(idx !== -1 ? idx : 0);
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

    const exportWeekPlanning = () => {
        const doc = new jsPDF({ orientation: "landscape" });

        doc.setFontSize(16);
        doc.text(
            `Weekly Planning (from ${weekDates[0]} to ${weekDates[6]})`,
            20,
            20
        );

        const rows = [];

        weekDates.forEach((date, i) => {
            const dayName = dayNames[i];
            const dayData = planningDataRefs.current[date] || {};

            posts.forEach(post => {
                shifts.forEach(shift => {
                    const key = `${post.id}-${shift.id}`;
                    const list = dayData[key] || [];

                    if (!list.length) return;

                    rows.push([
                        date,
                        dayName,
                        post.name,
                        shift.time,
                        list.map(e => e.employee_name).join(", ")
                    ]);
                });
            });
        });

        if (!rows.length) {
            alert("No planning to export");
            return;
        }

        autoTable(doc, {
            head: [["Date", "Day", "Post", "Shift", "Employees"]],
            body: rows,
            startY: 40,
            styles: { fontSize: 10 }
        });

        doc.save(`weekly_planning_${weekDates[0]}_to_${weekDates[6]}.pdf`);
    };


    // 🔥 NEW — remove employee from a cell 
    const handleRemoveEmployee = (postId, shiftId, emp_id, date) => {
        const key = `${postId}-${shiftId}`;

        // Safety check
        if (!planningDataRefs.current[date] || !planningDataRefs.current[date][key]) return;

        // Remove employee directly
        planningDataRefs.current[date][key] =
            planningDataRefs.current[date][key].filter(emp => emp.emp_id !== emp_id);

        // Force UI refresh
        setTick(t => t + 1);
    };


    //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
    const saveWeekPlanning = async () => {
        try {
            setSavingWeek(true);

            for (let i = 0; i < weekDates.length; i++) {
                const date = weekDates[i];

                // Directly save date (the correct one)
                await savePlanning(date, true);
            }

            alert("Weekly planning saved successfully!");

        } catch (err) {
            console.error(err);
            alert("Error saving weekly planning");
        } finally {
            setSavingWeek(false);
        }
    };




    return (
        <>
            <Header />
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    color: "black",
                    fontSize: "30px",
                    marginLeft: "35px",
                    marginTop: "40px",
                    marginBottom: "0px",
                }}
            >
                Weekly Planning Table
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    color: "black",
                    fontSize: "14px",
                    marginLeft: "35px",
                    marginTop: "5px",
                    marginBottom: "20px",
                }}
            >
                Organize and display work shifts for the entire week
            </div>

            <div style={{ margin: "0 35px 20px", display: "flex", alignItems: "center", gap: "15px" }}>
                <button
                    className="cntbtn"
                    onClick={() => navigateWeek('prev')}
                    style={{ padding: "8px 16px", width: "200px" }}

                >
                    ← Previous Week
                </button>
                <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                    Week of {formatDateDisplay(weekDates[0])} - {formatDateDisplay(weekDates[6])}
                </span>
                <button
                    className="cntbtn"
                    onClick={() => navigateWeek('next')}
                    style={{ padding: "8px 3px", width: "200px" }}
                >
                    Next Week →
                </button>
            </div>

            <div style={{ margin: "0 35px 20px" }}>
                <div className="tabs-container">
                    {dayNames.map((day, index) => (
                        <button
                            key={index}
                            className={`tab-button ${activeTab === index ? 'active' : ''}`}
                            onClick={() => setActiveTab(index)}
                        >
                            <div>{day}</div>
                            <div style={{ fontSize: "12px", opacity: 0.8 }}>
                                {new Date(weekDates[index]).getDate()}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ margin: "20px 35px", display: "flex", gap: "10px" }}>
                <button className="cntbtn" onClick={copyDay}>Copy Day</button>
                <button className="cntbtn" onClick={pasteDay}>Paste Day</button>
            </div>

            <div style={{ margin: "0 35px 20px", display: "flex", alignItems: "center", gap: "15px" }}>
                <span style={{ fontWeight: "bold" }}>
                    {formatDateDisplay(getCurrentDate())}
                </span>
                {loadingPlanning && <span>Loading planning...</span>}
                {!loadingPlanning && (
                    <span style={{ color: 'green', fontSize: '14px' }}>
                        Found {existingPlannings.current[getCurrentDate()]?.length || 0} assignments
                    </span>
                )}
            </div>

            <div>
                <table border="1" cellPadding="20" cellSpacing="0" style={{ width: "95%", margin: "0 auto" }}>
                    <thead>
                        <tr>
                            <th>Posts/Shifts</th>
                            {shifts.map(shift => (
                                <th key={shift.id}>{shift.name}</th>
                            ))}
                            <th>Operations</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map(post => (
                            <tr key={post.id}>
                                <td style={{ background: "linear-gradient(to right, #EB4219, #F6892A)", color: "white" }}>
                                    {post.name}
                                </td>

                                {shifts.map(shift => (

                                    <td key={shift.id}>

                                            {(getSelectedEmployee(post.id, shift.id, getCurrentDate()) || []).map(emp => (
                                                <div
                                                    key={emp.emp_id}
                                                    style={{
                                                        position: "relative",
                                                        cursor: "pointer",
                                                        color: "#EB4219",
                                                        fontWeight: "bold",
                                                        padding: "2px 0",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "4px"
                                                    }}
                                                    onMouseEnter={() => setHoveredEmployee(emp.emp_id)}
                                                    onMouseLeave={() => setHoveredEmployee(null)}
                                                >
                                                    <span>{emp.FirstName}</span>
                                                    <span>{emp.LastName}</span>

                                                    {hoveredEmployee === emp.emp_id && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                style={{
                                                                    fontSize: "14px",
                                                                    cursor: "pointer",
                                                                    background: "#4CAF50",
                                                                    color: "white",
                                                                    border: "none",
                                                                    borderRadius: "3px",
                                                                    padding: "2px 6px"
                                                                }}
                                                                onClick={() => setDropdownVisibleFor(`${post.id}-${shift.id}`)} // ✅ Changé: utilise post+shift au lieu de emp_id
                                                            >
                                                                +
                                                            </button>

                                                            <button
                                                                type="button"
                                                                style={{
                                                                    fontSize: "14px",
                                                                    cursor: "pointer",
                                                                    background: "#EB4219",
                                                                    color: "white",
                                                                    border: "none",
                                                                    borderRadius: "3px",
                                                                    padding: "2px 6px"
                                                                }}
                                                                onClick={() =>
                                                                    handleRemoveEmployee(post.id, shift.id, emp.emp_id, getCurrentDate())
                                                                }
                                                            >
                                                                -
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            ))}

                                            {/* ✅ Dropdown déplacé EN DEHORS du map - au niveau du shift */}
                                            {dropdownVisibleFor === `${post.id}-${shift.id}` && (
                                                <div style={{ marginTop: "8px" }}>
                                                    <DropDownList
                                                        employees={employees.filter(e =>
                                                            !(getSelectedEmployee(post.id, shift.id, getCurrentDate()) || []).some(sel => sel.emp_id === e.emp_id)
                                                        )}
                                                        onSelect={employee => {
                                                            handleEmployeeSelect(post.id, shift.id, employee, getCurrentDate());
                                                            setDropdownVisibleFor(null);
                                                        }}
                                                    />
                                                </div>
                                            )
                                            }

                                        {/* Initial dropdown if no employees assigned yet */}
                                        {(getSelectedEmployee(post.id, shift.id, getCurrentDate()) || []).length === 0 && (
                                            <DropDownList
                                                employees={employees}
                                                onSelect={employee =>
                                                    handleEmployeeSelect(post.id, shift.id, employee, getCurrentDate())
                                                }
                                            />
                                        )}
                                    </td>
                                ))}
                                <td>
                                    <button className="edit-btn" onClick={() => setIsOpen(true)}>Assign</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {isOpen && (
                    <div className="dialog-backdrop">
                        <div className="dialog-box">
                            <h3
                                style={{
                                    textAlign: "center",
                                    marginTop: "0",
                                    background: "linear-gradient(to right, #EB4219, #F6892A, #F36224, #EB4219)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent"
                                }}
                            >
                                Message
                            </h3>

                            <p style={{ textAlign: "center", fontSize: "16px", marginTop: "20px" }}>
                                Employee is added successfully to the cell.
                            </p>

                            <div style={{ textAlign: "center", marginTop: "30px" }}>
                                <button className="edit-btn" onClick={() => setIsOpen(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    onClick={exportWeekPlanning}
                    style={{
                        margin: '10px 0',
                        padding: '8px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Export Weekly Planning
                </button>

                {/* NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW */}
                <div className='cntbtns' style={{ display: "flex", gap: "15px", marginTop: "30px" }}>

                    {/* Save DAY button */}
                    <button
                        className='cntbtn'
                        onClick={() => savePlanning(weekDates[activeTab], false)}
                        disabled={saving || savingWeek}
                    >
                        {saving ? "Saving..." : `Save ${dayNames[activeTab]} Planning`}
                    </button>

                    {/* Save WEEK button */}
                    <button
                        className='cntbtn'
                        onClick={saveWeekPlanning}
                        disabled={saving || savingWeek}
                        style={{ backgroundColor: "#1f7ae0" }}
                    >
                        {savingWeek ? "Saving Week..." : "Save Week Planning"}
                    </button>

                    <button className="cntbtn" onClick={copyWeek}>Copy Week</button>
                    <button className="cntbtn" onClick={pasteWeek}>Paste Week</button>

                </div>


            </div>

            <style jsx>{`
                .tabs-container {
                    display: flex;
                    border-bottom: 2px solid #e0e0e0;
                }
                .tab-button {
                    flex: 1;
                    padding: 15px 10px;
                    border: none;
                    background: #f8f9fa;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-bottom: 3px solid transparent;
                    text-align: center;
                }
                .tab-button:hover {
                    background: #e9ecef;
                }
                .tab-button.active {
                    background: white;
                    border-bottom: 3px solid #EB4219;
                    font-weight: bold;
                    color: #EB4219;
                }
            `}</style>
        </>
    )
}
