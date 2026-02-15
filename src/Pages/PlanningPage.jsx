import Header from "../AuthContext/Header.jsx"
import DropDownList from "../Components/DropDownList"
import "../index.css"
import { useState, useEffect, useRef } from "react"
import ShiftsDropDownList from "../Components/ShiftDropDownList"
import { employeesApi } from "../services/employeesAPI"
import { planningApi } from "../services/planningAPI"
import { shiftApi } from '../services/shfitAPI.js';
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
        const currentDay = today.getDay();

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
    const [savingWeek, setSavingWeek] = useState(false);
    const [loadingPlanning, setLoadingPlanning] = useState(false);

    const [weekDates, setWeekDates] = useState(getWeekDates());
    const [activeTab, setActiveTab] = useState(() => {
        const idx = getTodayIndex(weekDates);
        return idx !== -1 ? idx : 0;
    });

    const [assignments, setAssignments] = useState({});
    const [copiedDay, setCopiedDay] = useState(null);
    const [copiedWeek, setCopiedWeek] = useState(null);
    const [tick, setTick] = useState(0);
    const [hoveredEmployee, setHoveredEmployee] = useState(null);
    const [dropdownVisibleFor, setDropdownVisibleFor] = useState(null);

    const planningDataRefs = useRef({});
    const existingPlannings = useRef({});

    // ========== SHIFT MANAGEMENT STATES ==========
    const [allShifts, setAllShifts] = useState([]); // All available shifts globally
    const [selectedShiftsPerDay, setSelectedShiftsPerDay] = useState({}); // { date: [shift_id, shift_id, ...] }
    const [showAddShiftForm, setShowAddShiftForm] = useState(false);
    const [newShift, setNewShift] = useState({ start_time: "", end_time: "" });
    const [editingShift, setEditingShift] = useState(null);
    const [showShiftSelector, setShowShiftSelector] = useState(false);

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

    // ========== LOAD ALL SHIFTS FROM DATABASE ==========
    useEffect(() => {
        const loadAllShifts = async () => {
            try {
                const data = await shiftApi.getShifts();
                const formattedShifts = data.map((s, index) => ({
                    id: s.shift_id,
                    shift_id: s.shift_id,
                    name: `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`,
                    time: `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`,
                    start_time: s.start_time,
                    end_time: s.end_time
                })).sort((a, b) => {
                    const timeToMinutes = (time) => {
                        const [h, m] = time.split(":").map(Number);
                        return h * 60 + m;
                    };
                    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
                });
                setAllShifts(formattedShifts);
            } catch (err) {
                console.error("Failed to fetch shifts:", err);
            }
        };

        loadAllShifts();
    }, []);

    // ========== GET SELECTED SHIFTS FOR CURRENT DAY ==========
    const getShiftsForCurrentDay = () => {
        const currentDate = getCurrentDate();
        const selectedIds = selectedShiftsPerDay[currentDate] || [];

        // If no shifts selected yet, return all shifts
        if (selectedIds.length === 0) {
            return allShifts;
        }

        // Return only selected shifts in order
        return allShifts.filter(shift => selectedIds.includes(shift.shift_id));
    };

    // ========== TOGGLE SHIFT SELECTION FOR CURRENT DAY ==========
    const toggleShiftForDay = (shiftId) => {
        const currentDate = getCurrentDate();
        const currentSelected = selectedShiftsPerDay[currentDate] || [];

        let newSelected;
        if (currentSelected.includes(shiftId)) {
            // Remove shift - but check if it has assignments first
            const hasAssignments = posts.some(post => {
                const key = `${post.id}-${shiftId}`;
                const dayData = planningDataRefs.current[currentDate] || {};
                const employees = dayData[key];
                return employees && ((Array.isArray(employees) && employees.length > 0) || employees.emp_id);
            });

            if (hasAssignments) {
                if (!window.confirm(
                    "⚠️ This shift has employee assignments. Removing it will delete those assignments. Continue?"
                )) {
                    return;
                }

                // Remove assignments for this shift
                posts.forEach(post => {
                    const key = `${post.id}-${shiftId}`;
                    if (planningDataRefs.current[currentDate]) {
                        delete planningDataRefs.current[currentDate][key];
                    }
                });
            }

            newSelected = currentSelected.filter(id => id !== shiftId);
        } else {
            // Add shift
            newSelected = [...currentSelected, shiftId];
        }

        setSelectedShiftsPerDay({
            ...selectedShiftsPerDay,
            [currentDate]: newSelected
        });
        setTick(t => t + 1);
    };

    // ========== SHIFT CRUD OPERATIONS ==========
    const handleAddShift = async (e) => {
        e.preventDefault();

        try {
            const added = await shiftApi.addShift(newShift);
            if (!added) return;

            // Add to allShifts and sort
            const updatedShifts = [...allShifts, {
                id: added.shift_id,
                shift_id: added.shift_id,
                name: `${added.start_time.slice(0, 5)}-${added.end_time.slice(0, 5)}`,
                time: `${added.start_time.slice(0, 5)}-${added.end_time.slice(0, 5)}`,
                start_time: added.start_time,
                end_time: added.end_time
            }].sort((a, b) => {
                const timeToMinutes = (time) => {
                    const [h, m] = time.split(":").map(Number);
                    return h * 60 + m;
                };
                return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
            });

            setAllShifts(updatedShifts);
            setShowAddShiftForm(false);
            setNewShift({ start_time: "", end_time: "" });
            alert("✅ Shift added successfully!");
        } catch (err) {
            console.error("Error adding shift:", err);
            alert("❌ Failed to add shift");
        }
    };

    const handleUpdateShift = async (e) => {
        e.preventDefault();
        if (!editingShift) return;

        try {
            const updated = await shiftApi.updateShift(editingShift.shift_id, {
                start_time: editingShift.start_time,
                end_time: editingShift.end_time,
            });

            if (!updated) return;

            // Update in allShifts
            setAllShifts(allShifts.map(s =>
                s.shift_id === editingShift.shift_id
                    ? {
                        ...s,
                        start_time: updated.start_time,
                        end_time: updated.end_time,
                        name: `${updated.start_time.slice(0, 5)}-${updated.end_time.slice(0, 5)}`,
                        time: `${updated.start_time.slice(0, 5)}-${updated.end_time.slice(0, 5)}`
                    }
                    : s
            ));

            setEditingShift(null);
            setShowAddShiftForm(false);
            alert("✅ Shift updated successfully!");
        } catch (err) {
            console.error("Error updating shift:", err);
            alert("❌ Failed to update shift");
        }
    };

    const handleDeleteShift = async (shiftId) => {
        // Check if shift is used in planning for ANY day
        let isUsed = false;
        Object.values(planningDataRefs.current).forEach(dayData => {
            if (!dayData) return;
            Object.keys(dayData).forEach(key => {
                const [postId, keyShiftId] = key.split('-');
                if (parseInt(keyShiftId) === shiftId) {
                    isUsed = true;
                }
            });
        });

        if (isUsed) {
            if (!window.confirm(
                "⚠️ This shift is currently assigned in the planning. " +
                "Deleting it will remove all associated assignments. " +
                "Are you sure you want to continue?"
            )) {
                return;
            }
        } else {
            if (!window.confirm("Are you sure you want to delete this shift?")) {
                return;
            }
        }

        try {
            const deleted = await shiftApi.deleteShift(shiftId);
            if (!deleted) return;

            // Remove from allShifts
            setAllShifts(allShifts.filter(s => s.shift_id !== shiftId));

            // Remove from selectedShiftsPerDay
            const updatedSelected = {};
            Object.keys(selectedShiftsPerDay).forEach(date => {
                updatedSelected[date] = selectedShiftsPerDay[date].filter(id => id !== shiftId);
            });
            setSelectedShiftsPerDay(updatedSelected);

            // Remove from planning data for all days
            Object.keys(planningDataRefs.current).forEach(date => {
                const dayData = planningDataRefs.current[date];
                if (!dayData) return;

                Object.keys(dayData).forEach(key => {
                    const [postId, keyShiftId] = key.split('-');
                    if (parseInt(keyShiftId) === shiftId) {
                        delete dayData[key];
                    }
                });
            });

            setTick(t => t + 1);
            alert("✅ Shift deleted successfully!");
        } catch (err) {
            console.error("Error deleting shift:", err);
            alert("❌ Failed to delete shift");
        }
    };

    // ========== EMPLOYEES LOADING (CACHED) ==========
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

                if (employeesCachePromise) {
                    const cached = await employeesCachePromise;
                    if (cached && isMounted) {
                        useCached(cached);
                    }
                    return;
                }

                employeesCachePromise = (async () => {
                    try {
                        const employeesData = await planningApi.getEmployees();
                        const transformed = transform(employeesData || []);
                        employeesCache = transformed;
                        return transformed;
                    } catch (err) {
                        employeesCache = null;
                        throw err;
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

        if (employeesCache) {
            useCached(employeesCache);
        } else {
            fetchAndCache();
        }

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (employees.length > 0) {
            loadExistingPlanningForTab(activeTab);
        }
    }, [activeTab, employees]);

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

            // Extract unique shift IDs from planning data
            const usedShiftIds = new Set();

            planningData.forEach((assignment) => {
                const key = `${assignment.task_id}-${assignment.shift_id}`;
                usedShiftIds.add(assignment.shift_id);

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
                        task_id: assignment.task_id,
                        shift_id: assignment.shift_id,
                        plan_date: date,
                        custom_start_time: assignment.custom_start_time || '',
                        custom_end_time: assignment.custom_end_time || ''
                    });
                }
            });

            // Auto-populate selectedShiftsPerDay with shifts from planning
            if (usedShiftIds.size > 0 && !selectedShiftsPerDay[date]) {
                setSelectedShiftsPerDay(prev => ({
                    ...prev,
                    [date]: Array.from(usedShiftIds)
                }));
            }

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
                employee_FirstName: employee.FirstName,
                employee_LastName: employee.LastName,
                custom_start_time: '',
                custom_end_time: ''
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
                FirstName: e.employee_FirstName || employees.find(emp => emp.emp_id === e.emp_id)?.FirstName || "Unknown",
                LastName: e.employee_LastName || employees.find(emp => emp.emp_id === e.emp_id)?.LastName || "",
                custom_start_time: e.custom_start_time || '',
                custom_end_time: e.custom_end_time || ''
            }));
        }

        if (entry.emp_id) {
            return [{
                emp_id: entry.emp_id,
                FirstName: entry.employee_FirstName || employees.find(emp => emp.emp_id === entry.emp_id)?.FirstName || "Unknown",
                LastName: entry.employee_LastName || employees.find(emp => emp.emp_id === entry.emp_id)?.LastName || "",
                custom_start_time: entry.custom_start_time || '',
                custom_end_time: entry.custom_end_time || ''
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
                                custom_start_time: emp.custom_start_time || null,
                                custom_end_time: emp.custom_end_time || null
                            });
                        }
                    });
                } else if (employees.emp_id) {
                    planningArray.push({
                        shift_id: parseInt(shiftId),
                        emp_id: employees.emp_id,
                        task_id: parseInt(postId),
                        plan_date: currentDate,
                        custom_start_time: employees.custom_start_time || null,
                        custom_end_time: employees.custom_end_time || null
                    });
                }
            });

            await planningApi.savePlanning({
                plan_date: currentDate,
                assignments: planningArray,
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
                                        plan_date: date,
                                        custom_start_time: emp.custom_start_time || null,
                                        custom_end_time: emp.custom_end_time || null
                                    });
                                }
                            });
                        } else if (item.emp_id) {
                            planningArray.push({
                                shift_id: item.shift_id,
                                emp_id: item.emp_id,
                                task_id: item.task_id,
                                plan_date: date,
                                custom_start_time: item.custom_start_time || null,
                                custom_end_time: item.custom_end_time || null
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

        setCopiedDay({
            planning: JSON.parse(JSON.stringify(filtered)),
            shifts: selectedShiftsPerDay[date] ? [...selectedShiftsPerDay[date]] : []
        });
        alert(`Planning for ${formatDateDisplay(date)} copied successfully!`);
    };

    const copyWeek = () => {
        if (!weekDates || weekDates.length === 0) {
            alert("No week to copy!");
            return;
        }

        const weekPlanning = {};

        weekDates.forEach(date => {
            weekPlanning[date] = {
                planning: planningDataRefs.current[date]
                    ? JSON.parse(JSON.stringify(planningDataRefs.current[date]))
                    : {},
                shifts: selectedShiftsPerDay[date] ? [...selectedShiftsPerDay[date]] : []
            };
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

        planningDataRefs.current[date] = JSON.parse(JSON.stringify(copiedDay.planning));

        setSelectedShiftsPerDay({
            ...selectedShiftsPerDay,
            [date]: [...copiedDay.shifts]
        });

        setTick(t => t + 1);

        alert(`✅ Copied planning pasted to ${formatDateDisplay(date)}!`);
    };

    const pasteWeek = () => {
        if (!copiedWeek) {
            alert("No week copied yet!");
            return;
        }

        if (!weekDates || weekDates.length === 0) return;

        const newSelectedShifts = {};

        weekDates.forEach((date, idx) => {
            const copiedDate = Object.keys(copiedWeek)[idx];

            planningDataRefs.current[date] = copiedWeek[copiedDate]?.planning
                ? JSON.parse(JSON.stringify(copiedWeek[copiedDate].planning))
                : {};

            newSelectedShifts[date] = copiedWeek[copiedDate]?.shifts
                ? [...copiedWeek[copiedDate].shifts]
                : [];
        });

        setSelectedShiftsPerDay(newSelectedShifts);
        setTick(t => t + 1);
        alert("✅ Copied week planning pasted successfully!");
    };

    const navigateWeek = (direction) => {
        const newWeekDates = weekDates.map(date => {
            const d = new Date(date);
            d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
            return d.toISOString().split("T")[0];
        });

        setWeekDates(newWeekDates);

        const idx = getTodayIndex(newWeekDates);
        setActiveTab(idx !== -1 ? idx : 0);
    };

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
            const shiftsForDay = selectedShiftsPerDay[date]
                ? allShifts.filter(s => selectedShiftsPerDay[date].includes(s.shift_id))
                : allShifts;

            posts.forEach(post => {
                shiftsForDay.forEach(shift => {
                    const key = `${post.id}-${shift.shift_id}`;
                    const list = dayData[key] || [];

                    if (!list.length) return;

                    list.forEach(emp => {
                        const timeDisplay = (emp.custom_start_time && emp.custom_end_time)
                            ? `${emp.custom_start_time}-${emp.custom_end_time}`
                            : shift.time;

                        const employeeName = `${emp.employee_FirstName || ''} ${emp.employee_LastName || ''}`.trim();

                        rows.push([
                            date,
                            dayName,
                            post.name,
                            timeDisplay,
                            employeeName
                        ]);
                    });
                });
            });
        });

        if (!rows.length) {
            alert("No planning to export");
            return;
        }

        autoTable(doc, {
            head: [["Date", "Day", "Post", "Time", "Employee"]],
            body: rows,
            startY: 40,
            styles: { fontSize: 10 }
        });

        doc.save(`weekly_planning_${weekDates[0]}_to_${weekDates[6]}.pdf`);
    };

    const handleRemoveEmployee = (postId, shiftId, emp_id, date) => {
        const key = `${postId}-${shiftId}`;

        if (!planningDataRefs.current[date] || !planningDataRefs.current[date][key]) return;

        planningDataRefs.current[date][key] =
            planningDataRefs.current[date][key].filter(emp => emp.emp_id !== emp_id);

        setTick(t => t + 1);
    };

    const saveWeekPlanning = async () => {
        try {
            setSavingWeek(true);

            for (let i = 0; i < weekDates.length; i++) {
                const date = weekDates[i];
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

    const shiftsToDisplay = getShiftsForCurrentDay();

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

            {/* ========== GLOBAL SHIFT MANAGEMENT SECTION ========== */}
            <div className="shift-management-container">
                <div className="compact-header" onClick={() => setShowAddShiftForm(!showAddShiftForm)} style={{ cursor: 'pointer' }}>
                    <div className="compact-header-left">
                        <span className="compact-icon">⏰</span>
                        <div>
                            <span className="compact-title">Global Shifts</span>
                            <span className="compact-count">({allShifts.length} shifts)</span>
                        </div>
                    </div>
                    <button
                        className="compact-toggle-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAddShiftForm(!showAddShiftForm);
                        }}
                    >
                        {showAddShiftForm ? '▼ Hide' : '▶ Manage'}
                    </button>
                </div>

                {showAddShiftForm && (
                    <div className="management-content">
                        {/* Add/Edit Shift Form */}
                        {editingShift ? (
                            <form onSubmit={handleUpdateShift} className="compact-shift-form">
                                <div className="compact-form-row">
                                    <span className="form-label-mini">✏️ Edit:</span>
                                    <input
                                        type="time"
                                        required
                                        value={editingShift.start_time}
                                        onChange={(e) => setEditingShift({ ...editingShift, start_time: e.target.value })}
                                        className="time-input-mini"
                                    />
                                    <span className="time-separator-mini">→</span>
                                    <input
                                        type="time"
                                        required
                                        value={editingShift.end_time}
                                        onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                                        className="time-input-mini"
                                    />
                                    <button type="submit" className="mini-btn save-btn">💾</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingShift(null);
                                        }}
                                        className="mini-btn cancel-btn"
                                    >
                                        ✖
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleAddShift} className="compact-shift-form">
                                <div className="compact-form-row">
                                    <span className="form-label-mini">➕ New:</span>
                                    <input
                                        type="time"
                                        required
                                        value={newShift.start_time}
                                        onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                                        className="time-input-mini"
                                        placeholder="Start"
                                    />
                                    <span className="time-separator-mini">→</span>
                                    <input
                                        type="time"
                                        required
                                        value={newShift.end_time}
                                        onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                                        className="time-input-mini"
                                        placeholder="End"
                                    />
                                    <button type="submit" className="mini-btn add-btn">✅</button>
                                </div>
                            </form>
                        )}

                        {/* Display All Global Shifts */}
                        <div className="shifts-compact-grid">
                            {allShifts.length === 0 ? (
                                <div className="empty-state-mini">
                                    No shifts yet. Add one above ↑
                                </div>
                            ) : (
                                allShifts.map((shift) => (
                                    <div key={shift.shift_id} className="shift-chip">
                                        <span className="shift-chip-time">{shift.time}</span>
                                        <div className="shift-chip-actions">
                                            <button
                                                onClick={() => setEditingShift(shift)}
                                                className="chip-action-btn"
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDeleteShift(shift.shift_id)}
                                                className="chip-action-btn"
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ========== SELECT SHIFTS FOR CURRENT DAY ========== */}
            <div className="day-shift-selector">
                <div className="compact-header" onClick={() => setShowShiftSelector(!showShiftSelector)} style={{ cursor: 'pointer' }}>
                    <div className="compact-header-left">
                        <span className="compact-icon">📋</span>
                        <div>
                            <span className="compact-title">{formatDateDisplay(getCurrentDate())}</span>
                            <span className="compact-count">
                                ({shiftsToDisplay.length > 0 ? `${shiftsToDisplay.length} active` : 'All shifts'})
                            </span>
                        </div>
                    </div>
                    <button
                        className="compact-toggle-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowShiftSelector(!showShiftSelector);
                        }}
                    >
                        {showShiftSelector ? '▼ Hide' : '▶ Select'}
                    </button>
                </div>

                {showShiftSelector && (
                    <div className="management-content">
                        <div className="instruction-mini">
                            💡 Click shifts to toggle for this day
                        </div>
                        <div className="shift-select-compact">
                            {allShifts.length === 0 ? (
                                <div className="empty-state-mini">
                                    Create shifts in Global Shifts above ↑
                                </div>
                            ) : (
                                allShifts.map(shift => {
                                    const isSelected = (selectedShiftsPerDay[getCurrentDate()] || []).includes(shift.shift_id);
                                    return (
                                        <button
                                            key={shift.shift_id}
                                            onClick={() => toggleShiftForDay(shift.shift_id)}
                                            className={`shift-select-chip ${isSelected ? 'selected' : ''}`}
                                        >
                                            <span className="select-checkbox">{isSelected ? '✅' : '⬜'}</span>
                                            <span>{shift.time}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Compact display of active shifts */}
                {!showShiftSelector && shiftsToDisplay.length > 0 && (
                    <div className="active-preview">
                        {shiftsToDisplay.map(shift => (
                            <span key={shift.shift_id} className="preview-badge">
                                {shift.time}
                            </span>
                        ))}
                    </div>
                )}
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
                            {shiftsToDisplay.map(shift => (
                                <th key={shift.shift_id}>{shift.name}</th>
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


                                {shiftsToDisplay.map(shift => (
                                    <td key={shift.shift_id}>
                                        {(getSelectedEmployee(post.id, shift.shift_id, getCurrentDate()) || []).map(emp => {
                                            const key = `${post.id}-${shift.shift_id}`;
                                            const currentDate = getCurrentDate();
                                            const empData = planningDataRefs.current[currentDate]?.[key]?.find(e => e.emp_id === emp.emp_id);
                                            const customStart = empData?.custom_start_time || '';
                                            const customEnd = empData?.custom_end_time || '';

                                            return (

                                                <div
                                                    key={emp.emp_id}
                                                    style={{
                                                        position: "relative",
                                                        cursor: "pointer",
                                                        color: "#EB4219",
                                                        fontWeight: "bold",

                                                        padding: "4px 0",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "4px",
                                                        borderBottom: "1px solid #f0f0f0"

                                                    }}
                                                    onMouseEnter={() => setHoveredEmployee(emp.emp_id)}
                                                    onMouseLeave={() => setHoveredEmployee(null)}
                                                >

                                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <span>{emp.FirstName} {emp.LastName}</span>
                                                        {(customStart || customEnd) && (
                                                            <span style={{ fontSize: "11px", color: "#666", fontWeight: "normal" }}>
                                                                ⏰
                                                            </span>
                                                        )}


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
                                                                    onClick={() => setDropdownVisibleFor(emp.emp_id)}
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
                                                                        handleRemoveEmployee(post.id, shift.shift_id, emp.emp_id, getCurrentDate())
                                                                    }
                                                                >
                                                                    -
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>

                                                    {hoveredEmployee === emp.emp_id && (
                                                        <div style={{
                                                            display: "flex",
                                                            gap: "4px",
                                                            alignItems: "center",
                                                            fontSize: "11px",
                                                            fontWeight: "normal"
                                                        }}>
                                                            <input
                                                                type="time"
                                                                value={customStart}
                                                                onChange={(e) => {
                                                                    const currentDate = getCurrentDate();
                                                                    const key = `${post.id}-${shift.shift_id}`;
                                                                    if (planningDataRefs.current[currentDate]?.[key]) {
                                                                        const empIndex = planningDataRefs.current[currentDate][key].findIndex(e => e.emp_id === emp.emp_id);
                                                                        if (empIndex !== -1) {
                                                                            planningDataRefs.current[currentDate][key][empIndex].custom_start_time = e.target.value;
                                                                            setTick(t => t + 1);
                                                                        }
                                                                    }
                                                                }}
                                                                placeholder={shift.start_time.slice(0, 5)}
                                                                style={{
                                                                    padding: "2px 4px",
                                                                    fontSize: "11px",
                                                                    border: "1px solid #ddd",
                                                                    borderRadius: "3px",
                                                                    width: "70px"
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <span>→</span>
                                                            <input
                                                                type="time"
                                                                value={customEnd}
                                                                onChange={(e) => {
                                                                    const currentDate = getCurrentDate();
                                                                    const key = `${post.id}-${shift.shift_id}`;
                                                                    if (planningDataRefs.current[currentDate]?.[key]) {
                                                                        const empIndex = planningDataRefs.current[currentDate][key].findIndex(e => e.emp_id === emp.emp_id);
                                                                        if (empIndex !== -1) {
                                                                            planningDataRefs.current[currentDate][key][empIndex].custom_end_time = e.target.value;
                                                                            setTick(t => t + 1);
                                                                        }
                                                                    }
                                                                }}
                                                                placeholder={shift.end_time.slice(0, 5)}
                                                                style={{
                                                                    padding: "2px 4px",
                                                                    fontSize: "11px",
                                                                    border: "1px solid #ddd",
                                                                    borderRadius: "3px",
                                                                    width: "70px"
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            {(customStart || customEnd) && (
                                                                <button
                                                                    type="button"
                                                                    style={{
                                                                        fontSize: "11px",
                                                                        cursor: "pointer",
                                                                        background: "#6c757d",
                                                                        color: "white",
                                                                        border: "none",
                                                                        borderRadius: "3px",
                                                                        padding: "2px 4px"
                                                                    }}
                                                                    onClick={() => {
                                                                        const currentDate = getCurrentDate();
                                                                        const key = `${post.id}-${shift.shift_id}`;
                                                                        if (planningDataRefs.current[currentDate]?.[key]) {
                                                                            const empIndex = planningDataRefs.current[currentDate][key].findIndex(e => e.emp_id === emp.emp_id);
                                                                            if (empIndex !== -1) {
                                                                                planningDataRefs.current[currentDate][key][empIndex].custom_start_time = '';
                                                                                planningDataRefs.current[currentDate][key][empIndex].custom_end_time = '';
                                                                                setTick(t => t + 1);
                                                                            }
                                                                        }
                                                                    }}
                                                                    title="Clear custom times"
                                                                >
                                                                    ✖
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {dropdownVisibleFor === emp.emp_id && (
                                                        <DropDownList
                                                            employees={employees.filter(e =>
                                                                !(getSelectedEmployee(post.id, shift.shift_id, getCurrentDate()) || []).some(sel => sel.emp_id === e.emp_id)
                                                            )}
                                                            onSelect={employee => {
                                                                handleEmployeeSelect(post.id, shift.shift_id, employee, getCurrentDate());
                                                                setDropdownVisibleFor(null);
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {(getSelectedEmployee(post.id, shift.shift_id, getCurrentDate()) || []).length === 0 && (
                                            <DropDownList
                                                employees={employees}
                                                onSelect={employee =>
                                                    handleEmployeeSelect(post.id, shift.shift_id, employee, getCurrentDate())
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

                <div className='cntbtns' style={{ display: "flex", gap: "15px", marginTop: "30px" }}>
                    <button
                        className='cntbtn'
                        onClick={() => savePlanning(weekDates[activeTab], false)}
                        disabled={saving || savingWeek}
                    >
                        {saving ? "Saving..." : `Save ${dayNames[activeTab]} Planning`}
                    </button>

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

                /* Minimal Compact Containers */
                .shift-management-container,
                .day-shift-selector {
                    margin: 10px 35px;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    background: white;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }

                .shift-management-container:hover,
                .day-shift-selector:hover {
                    border-color: #EB4219;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                }

                /* Compact Header */
                .compact-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: #f8f9fa;
                    border-bottom: 1px solid #e0e0e0;
                    transition: background 0.2s ease;
                }

                .compact-header:hover {
                    background: #e9ecef;
                }

                .compact-header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .compact-icon {
                    font-size: 20px;
                }

                .compact-title {
                    font-weight: 600;
                    color: #2c3e50;
                    font-size: 14px;
                }

                .compact-count {
                    font-size: 12px;
                    color: #6c757d;
                    margin-left: 6px;
                }

                .compact-toggle-btn {
                    padding: 6px 12px;
                    background: #EB4219;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }

                .compact-toggle-btn:hover {
                    background: #d63a15;
                    transform: scale(1.05);
                }

                /* Management Content */
                .management-content {
                    padding: 12px 16px;
                    animation: slideDown 0.3s ease;
                }

                @keyframes slideDown {
                    from {
                        opacity: 0;
                        max-height: 0;
                    }
                    to {
                        opacity: 1;
                        max-height: 500px;
                    }
                }

                /* Compact Form */
                .compact-shift-form {
                    margin-bottom: 12px;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 4px;
                }

                .compact-form-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .form-label-mini {
                    font-size: 13px;
                    font-weight: 600;
                    color: #495057;
                }

                .time-input-mini {
                    padding: 6px 10px;
                    font-size: 13px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    flex: 1;
                    min-width: 100px;
                }

                .time-input-mini:focus {
                    outline: none;
                    border-color: #007bff;
                }

                .time-separator-mini {
                    font-size: 14px;
                    color: #6c757d;
                }

                .mini-btn {
                    padding: 6px 10px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }

                .save-btn,
                .add-btn {
                    background: #28a745;
                    color: white;
                }

                .save-btn:hover,
                .add-btn:hover {
                    background: #218838;
                    transform: scale(1.1);
                }

                .cancel-btn {
                    background: #dc3545;
                    color: white;
                }

                .cancel-btn:hover {
                    background: #c82333;
                    transform: scale(1.1);
                }

                /* Compact Shifts Grid */
                .shifts-compact-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .shift-chip {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }

                .shift-chip:hover {
                    border-color: #EB4219;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .shift-chip-time {
                    font-weight: 600;
                    color: #2c3e50;
                }

                .shift-chip-actions {
                    display: flex;
                    gap: 4px;
                }

                .chip-action-btn {
                    padding: 2px 6px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    opacity: 0.6;
                    transition: all 0.2s ease;
                }

                .chip-action-btn:hover {
                    opacity: 1;
                    transform: scale(1.2);
                }

                /* Instruction Mini */
                .instruction-mini {
                    padding: 8px 12px;
                    background: #fff3cd;
                    border-left: 3px solid #ffc107;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #856404;
                    margin-bottom: 10px;
                }

                /* Shift Select Compact */
                .shift-select-compact {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .shift-select-chip {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .shift-select-chip:hover {
                    border-color: #007bff;
                    background: #e7f3ff;
                }

                .shift-select-chip.selected {
                    background: #d4edda;
                    border-color: #28a745;
                    color: #155724;
                    font-weight: 600;
                }

                .select-checkbox {
                    font-size: 16px;
                }

                /* Active Preview */
                .active-preview {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    padding: 8px 16px;
                    background: #f8f9fa;
                    border-top: 1px solid #e0e0e0;
                }

                .preview-badge {
                    padding: 4px 8px;
                    background: #d4edda;
                    color: #155724;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: 600;
                }

                /* Empty States */
                .empty-state-mini {
                    width: 100%;
                    text-align: center;
                    padding: 15px;
                    color: #6c757d;
                    font-size: 13px;
                    font-style: italic;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .shift-management-container,
                    .day-shift-selector {
                        margin: 10px 20px;
                    }

                    .compact-header {
                        padding: 10px 12px;
                    }

                    .compact-form-row {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .time-input-mini {
                        width: 100%;
                    }

                    .shifts-compact-grid,
                    .shift-select-compact {
                        flex-direction: column;
                    }

                    .shift-chip,
                    .shift-select-chip {
                        width: 100%;
                    }
                }
            `}</style>
        </>
    )
}