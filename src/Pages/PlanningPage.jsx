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

    // ========== NEW: VIEW MODE STATE ==========
    const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'template'

    // ========== NEW: TEMPLATE PLANNING STATE ==========
    const [templatePlanning, setTemplatePlanning] = useState({});
    const [templateSelectedShifts, setTemplateSelectedShifts] = useState([]);
    const [templateTick, setTemplateTick] = useState(0);
    const [templateHoveredEmployee, setTemplateHoveredEmployee] = useState(null);
    const [templateDropdownVisibleFor, setTemplateDropdownVisibleFor] = useState(null);

    // ========== NEW: CALENDAR MODAL STATES ==========
    const [showSaveCalendar, setShowSaveCalendar] = useState(false);
    const [showExportCalendar, setShowExportCalendar] = useState(false);
    const [showImportCalendar, setShowImportCalendar] = useState(false);
    const [selectedDates, setSelectedDates] = useState([]);
    const [dateRangeStart, setDateRangeStart] = useState('');
    const [dateRangeEnd, setDateRangeEnd] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [importDate, setImportDate] = useState('');

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
        { id: 5, name: "Caissier" },
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

    // ========== NEW: GET SHIFTS FOR TEMPLATE ==========
    const getShiftsForTemplate = () => {
        if (templateSelectedShifts.length === 0) {
            return allShifts;
        }
        return allShifts.filter(shift => templateSelectedShifts.includes(shift.shift_id));
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

    // ========== NEW: TOGGLE SHIFT FOR TEMPLATE ==========
    const toggleShiftForTemplate = (shiftId) => {
        let newSelected;
        if (templateSelectedShifts.includes(shiftId)) {
            // Check if shift has assignments
            const hasAssignments = posts.some(post => {
                const key = `${post.id}-${shiftId}`;
                const employees = templatePlanning[key];
                return employees && ((Array.isArray(employees) && employees.length > 0) || employees.emp_id);
            });

            if (hasAssignments) {
                if (!window.confirm(
                    "⚠️ This shift has employee assignments in template. Removing it will delete those assignments. Continue?"
                )) {
                    return;
                }

                // Remove assignments for this shift
                posts.forEach(post => {
                    const key = `${post.id}-${shiftId}`;
                    delete templatePlanning[key];
                });
            }

            newSelected = templateSelectedShifts.filter(id => id !== shiftId);
        } else {
            newSelected = [...templateSelectedShifts, shiftId];
        }

        setTemplateSelectedShifts(newSelected);
        setTemplateTick(t => t + 1);
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

        // Check in template
        Object.keys(templatePlanning).forEach(key => {
            const [postId, keyShiftId] = key.split('-');
            if (parseInt(keyShiftId) === shiftId) {
                isUsed = true;
            }
        });

        if (isUsed) {
            if (!window.confirm(
                "⚠️ This shift is currently assigned in planning or template. " +
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

            // Remove from template selected shifts
            setTemplateSelectedShifts(templateSelectedShifts.filter(id => id !== shiftId));

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

            // Remove from template planning
            Object.keys(templatePlanning).forEach(key => {
                const [postId, keyShiftId] = key.split('-');
                if (parseInt(keyShiftId) === shiftId) {
                    delete templatePlanning[key];
                }
            });

            setTick(t => t + 1);
            setTemplateTick(t => t + 1);
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
                const data = await shiftApi.getShifts();
                console.log("💾 Shifts data from API:", data);
                const formattedShifts = data.map((s, index) => ({
                    id: s.shift_id,
                    name: `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)} (${index + 1})`,
                    time: `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`
                }));

                setShifts(formattedShifts);
                console.log("💾 Loaded shifts:", formattedShifts);
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

    // ========== NEW: HANDLE EMPLOYEE SELECT FOR TEMPLATE ==========
    const handleTemplateEmployeeSelect = (postId, shiftId, employee) => {
        const key = `${postId}-${shiftId}`;

        if (!Array.isArray(templatePlanning[key])) {
            templatePlanning[key] = [];
        }

        const alreadyExists = templatePlanning[key].some(e => e.emp_id === employee.emp_id);

        if (!alreadyExists) {
            templatePlanning[key].push({
                shift_id: shiftId,
                emp_id: employee.emp_id,
                task_id: postId,
                employee_FirstName: employee.FirstName,
                employee_LastName: employee.LastName,
                custom_start_time: '',
                custom_end_time: ''
            });
            setTemplateTick(t => t + 1);
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

    // ========== NEW: GET TEMPLATE EMPLOYEE ==========
    const getTemplateEmployee = (postId, shiftId) => {
        const key = `${postId}-${shiftId}`;
        const entry = templatePlanning[key];

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
                                employee_FirstName: emp.employee_FirstName,
                                employee_LastName: emp.employee_LastName,
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
                        employee_FirstName: employees.employee_FirstName,
                        employee_LastName: employees.employee_LastName,
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
                                        employee_FirstName: emp.employee_FirstName,
                                        employee_LastName: emp.employee_LastName,
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
                                employee_FirstName: item.employee_FirstName,
                                employee_LastName: item.employee_LastName,
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

    // ========== NEW: APPLY TEMPLATE TO DATES ==========
    const applyTemplateToSelectedDates = async (dates) => {
        if (!dates || dates.length === 0) {
            alert("⚠️ Please select at least one date!");
            return;
        }

        // Check if template has any assignments
        const hasAssignments = Object.values(templatePlanning).some(
            val => Array.isArray(val) && val.length > 0
        );

        if (!hasAssignments) {
            alert("⚠️ Template is empty! Please assign employees first.");
            return;
        }

        try {
            setSavingTemplate(true);

            // Check for conflicts
            const conflicts = [];
            for (const date of dates) {
                try {
                    const existingPlanning = await planningApi.getPlanning(date);
                    if (existingPlanning && existingPlanning.length > 0) {
                        conflicts.push(date);
                    }
                } catch (err) {
                    console.error(`Error checking planning for ${date}:`, err);
                }
            }

            // Notify user about conflicts
            if (conflicts.length > 0) {
                const confirmMessage = `⚠️ The following dates already have planning:\n\n${conflicts.map(d => formatDateDisplay(d)).join('\n')}\n\nDo you want to REPLACE the existing planning with the template?`;

                if (!window.confirm(confirmMessage)) {
                    setSavingTemplate(false);
                    return;
                }
            }

            // Apply template to all selected dates
            let successCount = 0;
            for (const date of dates) {
                const planningArray = [];

                Object.entries(templatePlanning).forEach(([key, employees]) => {
                    if (!Array.isArray(employees)) return;

                    const [postId, shiftId] = key.split('-');

                    employees.forEach(emp => {
                        if (emp?.emp_id) {
                            // Include employee names when saving
                            planningArray.push({
                                shift_id: parseInt(shiftId),
                                emp_id: emp.emp_id,
                                task_id: parseInt(postId),
                                plan_date: date,
                                employee_FirstName: emp.employee_FirstName,
                                employee_LastName: emp.employee_LastName,
                                custom_start_time: emp.custom_start_time || null,
                                custom_end_time: emp.custom_end_time || null
                            });
                        }
                    });
                });

                if (planningArray.length > 0) {
                    await planningApi.savePlanning({
                        plan_date: date,
                        assignments: planningArray
                    });
                    successCount++;
                }
            }

            alert(`✅ Template applied successfully to ${successCount} date(s)!`);
            setShowSaveCalendar(false);
            setSelectedDates([]);
            setDateRangeStart('');
            setDateRangeEnd('');

            // Reload current planning if needed
            if (dates.includes(getCurrentDate())) {
                await loadExistingPlanningForTab(activeTab);
            }

        } catch (error) {
            console.error('❌ Error applying template:', error);
            alert('Error applying template: ' + error.message);
        } finally {
            setSavingTemplate(false);
        }
    };

    // ========== NEW: EXPORT SAVED PLANNING FOR SELECTED DATES (FIXED) ==========
    const exportTemplateForSelectedDates = async (dates) => {
        if (!dates || dates.length === 0) {
            alert("⚠️ Please select at least one date!");
            return;
        }

        const sortedDates = [...dates].sort();

        try {
            // Fetch actual saved planning data from database for all selected dates
            const allPlanningData = {};
            let hasAnyData = false;

            for (const date of sortedDates) {
                try {
                    const planningData = await planningApi.getPlanning(date);
                    console.log(`Planning data for ${date}:`, planningData);
                    if (planningData && planningData.length > 0) {
                        allPlanningData[date] = planningData;
                        hasAnyData = true;
                    }
                } catch (error) {
                    console.error(`Error loading planning for ${date}:`, error);
                }
            }

            if (!hasAnyData) {
                alert("⚠️ No saved planning found for the selected dates!");
                return;
            }

            // Create PDF
            const doc = new jsPDF({ orientation: "landscape" });

            doc.setFontSize(16);
            const startDate = new Date(sortedDates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endDate = new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            doc.text(
                `Planning from ${startDate} to ${endDate}`,
                20,
                20
            );

            const rows = [];
            let isFirstDate = true;

            // Build rows from actual saved planning data
            sortedDates.forEach(date => {
                const planningData = allPlanningData[date];
                if (!planningData || planningData.length === 0) return;

                // Add spacing row between dates (except before first date)
                if (!isFirstDate) {
                    rows.push(['', '', '', '', '']);
                }
                isFirstDate = false;

                const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

                // Process each assignment
                planningData.forEach(assignment => {
                    console.log('🔍 RAW Assignment from API:', JSON.stringify(assignment, null, 2));

                    // Find the post name
                    const post = posts.find(p => p.id === assignment.task_id);
                    const postName = post ? post.name : `Task ${assignment.task_id}`;

                    // Find the shift time
                    const shift = allShifts.find(s => s.shift_id === assignment.shift_id);
                    let timeDisplay = shift ? shift.time : 'N/A';

                    // Use custom times if available
                    if (assignment.custom_start_time && assignment.custom_end_time) {
                        timeDisplay = `${assignment.custom_start_time}-${assignment.custom_end_time}`;
                    }

                    // *** FIXED: Get employee full name with detailed logging ***
                    let employeeName = '';

                    console.log('📋 Checking employee fields:');
                    console.log('  - assignment.employee_FirstName:', assignment.employee_FirstName);
                    console.log('  - assignment.employee_LastName:', assignment.employee_LastName);
                    console.log('  - assignment.FirstName:', assignment.FirstName);
                    console.log('  - assignment.LastName:', assignment.LastName);
                    console.log('  - assignment.emp_id:', assignment.emp_id);

                    // PRIORITY 1: Try to find employee in the employees list first (most reliable)
                    const emp = employees.find(e => e.emp_id === assignment.emp_id);
                    if (emp && (emp.FirstName || emp.LastName)) {
                        employeeName = `${emp.FirstName || ''} ${emp.LastName || ''}`.trim();
                        console.log('✅ Found employee in employees list:', employeeName);
                    } else {
                        // PRIORITY 2: Try to get from assignment fields
                        const firstName = assignment.employee_FirstName || assignment.FirstName || '';
                        const lastName = assignment.employee_LastName || assignment.LastName || '';

                        console.log('  → Extracted firstName:', firstName);
                        console.log('  → Extracted lastName:', lastName);

                        // Construct full name
                        if (firstName && lastName) {
                            employeeName = `${firstName} ${lastName}`;
                        } else if (firstName) {
                            employeeName = firstName;
                            console.log('⚠️ WARNING: Only firstName available, no lastName!');
                        } else if (lastName) {
                            employeeName = lastName;
                        }
                    }

                    // Final fallback
                    if (!employeeName || employeeName.trim() === '') {
                        employeeName = `Employee ${assignment.emp_id}`;
                        console.log('⚠️ Using fallback name:', employeeName);
                    }

                    console.log('✅ Final employee name for export:', employeeName);

                    rows.push([
                        date,
                        dayOfWeek,
                        postName,
                        timeDisplay,
                        employeeName
                    ]);
                });
            });

            if (!rows.length || rows.every(r => r[0] === '')) {
                alert("⚠️ No planning data to export!");
                return;
            }

            autoTable(doc, {
                head: [["Date", "Day", "Post", "Time", "Employee"]],
                body: rows,
                startY: 40,
                styles: { fontSize: 10 },
                didParseCell: function (data) {
                    // Add background color to empty spacing rows
                    if (data.row.index > 0 && data.cell.raw === '') {
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                }
            });

            doc.save(`planning_${sortedDates[0]}_to_${sortedDates[sortedDates.length - 1]}.pdf`);

            setShowExportCalendar(false);
            setSelectedDates([]);
            setDateRangeStart('');
            setDateRangeEnd('');

            const actualRows = rows.filter(r => r[0] !== '');
            alert(`✅ Successfully exported planning for ${actualRows.length} assignments!`);

        } catch (error) {
            console.error('Error exporting planning:', error);
            alert('❌ Error exporting planning: ' + error.message);
        }
    };

    // ========== NEW: IMPORT PLANNING FROM DATE ==========
    const importPlanningFromDate = async () => {
        if (!importDate) {
            alert("⚠️ Please select a date to import from!");
            return;
        }

        try {
            // Fetch planning for the selected date
            const planningData = await planningApi.getPlanning(importDate);

            if (!planningData || planningData.length === 0) {
                alert(`⚠️ No planning found for ${formatDateDisplay(importDate)}`);
                return;
            }

            // Clear current template
            setTemplatePlanning({});

            // Extract unique shift IDs
            const usedShiftIds = new Set();

            // Build template from imported data
            const newTemplate = {};
            planningData.forEach((assignment) => {
                const key = `${assignment.task_id}-${assignment.shift_id}`;
                usedShiftIds.add(assignment.shift_id);

                if (!Array.isArray(newTemplate[key])) {
                    newTemplate[key] = [];
                }

                const alreadyExists = newTemplate[key].some(
                    (emp) => emp.emp_id === assignment.emp_id
                );

                if (!alreadyExists) {
                    newTemplate[key].push({
                        emp_id: assignment.emp_id,
                        employee_FirstName: assignment.employee_FirstName,
                        employee_LastName: assignment.employee_LastName,
                        task_id: assignment.task_id,
                        shift_id: assignment.shift_id,
                        custom_start_time: assignment.custom_start_time || '',
                        custom_end_time: assignment.custom_end_time || ''
                    });
                }
            });

            setTemplatePlanning(newTemplate);
            setTemplateSelectedShifts(Array.from(usedShiftIds));
            setTemplateTick(t => t + 1);

            setShowImportCalendar(false);
            setImportDate('');

            alert(`✅ Successfully imported planning from ${formatDateDisplay(importDate)}!`);

        } catch (error) {
            console.error('❌ Error importing planning:', error);
            alert('Error importing planning: ' + error.message);
        }
    };

    // ========== NEW: HANDLE DATE SELECTION ==========
    const toggleDateSelection = (date) => {
        if (selectedDates.includes(date)) {
            setSelectedDates(selectedDates.filter(d => d !== date));
        } else {
            setSelectedDates([...selectedDates, date]);
        }
    };

    // ========== NEW: ADD DATE RANGE ==========
    const addDateRange = () => {
        if (!dateRangeStart || !dateRangeEnd) {
            alert("⚠️ Please select both start and end dates!");
            return;
        }

        const start = new Date(dateRangeStart);
        const end = new Date(dateRangeEnd);

        if (start > end) {
            alert("⚠️ Start date must be before end date!");
            return;
        }

        const newDates = [];
        const current = new Date(start);

        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            if (!selectedDates.includes(dateStr)) {
                newDates.push(dateStr);
            }
            current.setDate(current.getDate() + 1);
        }

        setSelectedDates([...selectedDates, ...newDates]);
        setDateRangeStart('');
        setDateRangeEnd('');
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

            // Get only the selected shifts for this date
            const selectedShiftIds = selectedShiftsPerDay[date] || [];
            const shiftsForDay = selectedShiftIds.length > 0
                ? allShifts.filter(s => selectedShiftIds.includes(s.shift_id))
                : allShifts;

            posts.forEach(post => {
                shiftsForDay.forEach(shift => {
                    const key = `${post.id}-${shift.shift_id}`;
                    const list = dayData[key] || [];

                    if (!Array.isArray(list) || list.length === 0) return;

                    list.forEach(emp => {
                        const timeDisplay = (emp.custom_start_time && emp.custom_end_time)
                            ? `${emp.custom_start_time}-${emp.custom_end_time}`
                            : shift.time;

                        // Get employee full name - use employees list as primary source
                        let employeeName = '';

                        // Try to find in employees list first (most reliable)
                        const empFromList = employees.find(e => e.emp_id === emp.emp_id);
                        if (empFromList && (empFromList.FirstName || empFromList.LastName)) {
                            employeeName = `${empFromList.FirstName || ''} ${empFromList.LastName || ''}`.trim();
                        } else {
                            // Fallback to stored names
                            employeeName = `${emp.employee_FirstName || ''} ${emp.employee_LastName || ''}`.trim();
                        }

                        // Final fallback
                        if (!employeeName) {
                            employeeName = `Employee ${emp.emp_id}`;
                        }

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

    // ========== NEW: REMOVE EMPLOYEE FROM TEMPLATE ==========
    const handleRemoveTemplateEmployee = (postId, shiftId, emp_id) => {
        const key = `${postId}-${shiftId}`;

        if (!templatePlanning[key]) return;

        templatePlanning[key] = templatePlanning[key].filter(emp => emp.emp_id !== emp_id);
        setTemplateTick(t => t + 1);
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

    const shiftsToDisplay = viewMode === 'daily' ? getShiftsForCurrentDay() : getShiftsForTemplate();

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

            {/* ========== NEW: VIEW MODE TABS ========== */}
            <div style={{ margin: "0 35px 20px" }}>
                <div className="view-mode-tabs">
                    <button
                        className={`view-tab ${viewMode === 'daily' ? 'active' : ''}`}
                        onClick={() => setViewMode('daily')}
                    >
                        📅 View Plannings
                    </button>
                    <button
                        className={`view-tab ${viewMode === 'template' ? 'active' : ''}`}
                        onClick={() => setViewMode('template')}
                    >
                        📋 New Planning
                    </button>
                </div>
            </div>

            {/* ========== DAILY PLANNING VIEW (READ ONLY) ========== */}
            {viewMode === 'daily' && (
                <>
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

                    <div style={{ margin: "0 35px 20px", display: "flex", alignItems: "center", gap: "15px" }}>
                        <span style={{ fontWeight: "bold" }}>
                            {formatDateDisplay(getCurrentDate())}
                        </span>
                        {loadingPlanning && <span>Loading planning...</span>}
                        {!loadingPlanning && (
                            <span style={{ color: 'green', fontSize: '14px' }}>
                                {existingPlannings.current[getCurrentDate()]?.length || 0} assignments
                            </span>
                        )}
                    </div>

                    <div>
                        <table border="1" cellPadding="20" cellSpacing="0" style={{ width: "95%", margin: "0 auto" }}>
                            <thead>
                                <tr>
                                    <th>Posts/Shifts</th>
                                    {getShiftsForCurrentDay().map(shift => (
                                        <th key={shift.shift_id}>{shift.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {posts.map(post => (
                                    <tr key={post.id}>
                                        <td style={{ background: "linear-gradient(to right, #EB4219, #F6892A)", color: "white" }}>
                                            {post.name}
                                        </td>

                                        {getShiftsForCurrentDay().map(shift => (
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
                                                                color: "#EB4219",
                                                                fontWeight: "bold",
                                                                padding: "4px 0",
                                                                borderBottom: "1px solid #f0f0f0"
                                                            }}
                                                        >
                                                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                                <span>{emp.FirstName} {emp.LastName}</span>
                                                                {(customStart || customEnd) && (
                                                                    <span style={{ fontSize: "11px", color: "#666", fontWeight: "normal" }}>
                                                                        ({customStart || shift.start_time.slice(0, 5)}-{customEnd || shift.end_time.slice(0, 5)})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {(getSelectedEmployee(post.id, shift.shift_id, getCurrentDate()) || []).length === 0 && (
                                                    <span style={{ color: "#ccc", fontStyle: "italic" }}>No assignment</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ========== TEMPLATE PLANNING VIEW ========== */}
            {viewMode === 'template' && (
                <>
                    {/* ========== GLOBAL SHIFT MANAGEMENT IN TEMPLATE ========== */}
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
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteShift(shift.shift_id)}
                                                        className="chip-action-btn"
                                                        title="Delete"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Template Shift Selector */}
                    <div className="day-shift-selector">
                        <div className="compact-header" onClick={() => setShowShiftSelector(!showShiftSelector)} style={{ cursor: 'pointer' }}>
                            <div className="compact-header-left">
                                <span className="compact-icon">📋</span>
                                <div>
                                    <span className="compact-title">Select Shifts for Template</span>
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
                                    💡 Click shifts to toggle for template
                                </div>
                                <div className="shift-select-compact">
                                    {allShifts.length === 0 ? (
                                        <div className="empty-state-mini">
                                            Create shifts in Daily Planning → Global Shifts ↑
                                        </div>
                                    ) : (
                                        allShifts.map(shift => {
                                            const isSelected = templateSelectedShifts.includes(shift.shift_id);
                                            return (
                                                <button
                                                    key={shift.shift_id}
                                                    onClick={() => toggleShiftForTemplate(shift.shift_id)}
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

                    {/* Template Planning Table */}
                    <div style={{ margin: "20px 35px" }}>
                        <table border="1" cellPadding="20" cellSpacing="0" style={{ width: "95%", margin: "0 auto" }}>
                            <thead>
                                <tr>
                                    <th>Posts/Shifts</th>
                                    {shiftsToDisplay.map(shift => (
                                        <th key={shift.shift_id}>{shift.name}</th>
                                    ))}
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
                                                {(getTemplateEmployee(post.id, shift.shift_id) || []).map(emp => {
                                                    const key = `${post.id}-${shift.shift_id}`;
                                                    const empData = templatePlanning[key]?.find(e => e.emp_id === emp.emp_id);
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
                                                            onMouseEnter={() => setTemplateHoveredEmployee(emp.emp_id)}
                                                            onMouseLeave={() => setTemplateHoveredEmployee(null)}
                                                        >
                                                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                                <span>{emp.FirstName} {emp.LastName}</span>
                                                                {(customStart || customEnd) && (
                                                                    <span style={{ fontSize: "11px", color: "#666", fontWeight: "normal" }}>
                                                                        ⏰
                                                                    </span>
                                                                )}

                                                                {templateHoveredEmployee === emp.emp_id && (
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
                                                                            onClick={() => setTemplateDropdownVisibleFor(emp.emp_id)}
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
                                                                                handleRemoveTemplateEmployee(post.id, shift.shift_id, emp.emp_id)
                                                                            }
                                                                        >
                                                                            -
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {templateHoveredEmployee === emp.emp_id && (
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
                                                                            const key = `${post.id}-${shift.shift_id}`;
                                                                            if (templatePlanning[key]) {
                                                                                const empIndex = templatePlanning[key].findIndex(e => e.emp_id === emp.emp_id);
                                                                                if (empIndex !== -1) {
                                                                                    templatePlanning[key][empIndex].custom_start_time = e.target.value;
                                                                                    setTemplateTick(t => t + 1);
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
                                                                            const key = `${post.id}-${shift.shift_id}`;
                                                                            if (templatePlanning[key]) {
                                                                                const empIndex = templatePlanning[key].findIndex(e => e.emp_id === emp.emp_id);
                                                                                if (empIndex !== -1) {
                                                                                    templatePlanning[key][empIndex].custom_end_time = e.target.value;
                                                                                    setTemplateTick(t => t + 1);
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
                                                                                const key = `${post.id}-${shift.shift_id}`;
                                                                                if (templatePlanning[key]) {
                                                                                    const empIndex = templatePlanning[key].findIndex(e => e.emp_id === emp.emp_id);
                                                                                    if (empIndex !== -1) {
                                                                                        templatePlanning[key][empIndex].custom_start_time = '';
                                                                                        templatePlanning[key][empIndex].custom_end_time = '';
                                                                                        setTemplateTick(t => t + 1);
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

                                                            {templateDropdownVisibleFor === emp.emp_id && (
                                                                <DropDownList
                                                                    employees={employees.filter(e =>
                                                                        !(getTemplateEmployee(post.id, shift.shift_id) || []).some(sel => sel.emp_id === e.emp_id)
                                                                    )}
                                                                    onSelect={employee => {
                                                                        handleTemplateEmployeeSelect(post.id, shift.shift_id, employee);
                                                                        setTemplateDropdownVisibleFor(null);
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {(getTemplateEmployee(post.id, shift.shift_id) || []).length === 0 && (
                                                    <DropDownList
                                                        employees={employees}
                                                        onSelect={employee =>
                                                            handleTemplateEmployeeSelect(post.id, shift.shift_id, employee)
                                                        }
                                                    />
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Template Action Buttons */}
                    <div className='cntbtns' style={{ display: "flex", gap: "15px", marginTop: "30px", marginLeft: "35px", flexWrap: "wrap" }}>
                        <button
                            className='cntbtn'
                            onClick={() => setShowImportCalendar(true)}
                            style={{ backgroundColor: "#6f42c1" }}
                        >
                            📥 Import from Date
                        </button>

                        <button
                            className='cntbtn template-save-btn'
                            onClick={() => setShowSaveCalendar(true)}
                            disabled={savingTemplate}
                        >
                            💾 Save
                        </button>

                        <button
                            className='cntbtn template-export-btn'
                            onClick={() => setShowExportCalendar(true)}
                            style={{ backgroundColor: "#28a745" }}
                        >
                            📄 Export
                        </button>
                    </div>
                </>
            )}

            {/* ========== NEW: SAVE CALENDAR MODAL ========== */}
            {showSaveCalendar && (
                <div className="dialog-backdrop">
                    <div className="calendar-modal-better">
                        <div className="modal-header-orange">
                            <div className="header-icon">📅</div>
                            <div>
                                <div className="header-title">Select Planning Days</div>
                                <div className="header-subtitle">Choose which days this planning applies to</div>
                            </div>
                        </div>

                        <div className="date-picker-section">
                            <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '14px', fontWeight: 600 }}>📆 Add Date Range</h4>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <div className="date-input-group" style={{ flex: 1 }}>
                                    <label>Start date</label>
                                    <input
                                        type="date"
                                        value={dateRangeStart}
                                        onChange={(e) => {
                                            console.log("Save - Start date changed:", e.target.value);
                                            setDateRangeStart(e.target.value);
                                        }}
                                        className="date-input-styled"
                                    />
                                </div>
                                <div className="date-input-group" style={{ flex: 1 }}>
                                    <label>End date</label>
                                    <input
                                        type="date"
                                        value={dateRangeEnd}
                                        onChange={(e) => {
                                            console.log("Save - End date changed:", e.target.value);
                                            setDateRangeEnd(e.target.value);
                                        }}
                                        className="date-input-styled"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (!dateRangeStart || !dateRangeEnd) {
                                        alert("⚠️ Please select both start and end dates!");
                                        return;
                                    }

                                    const start = new Date(dateRangeStart);
                                    const end = new Date(dateRangeEnd);

                                    if (start > end) {
                                        alert("⚠️ Start date must be before end date!");
                                        return;
                                    }

                                    const newDates = [];
                                    const current = new Date(start);

                                    while (current <= end) {
                                        const dateStr = current.toISOString().split('T')[0];
                                        if (!selectedDates.includes(dateStr)) {
                                            newDates.push(dateStr);
                                        }
                                        current.setDate(current.getDate() + 1);
                                    }

                                    setSelectedDates([...selectedDates, ...newDates]);
                                    setDateRangeStart('');
                                    setDateRangeEnd('');
                                }}
                                className="add-range-btn"
                                style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                            >
                                ➕ Add Range
                            </button>

                            <div style={{ margin: '20px 0', borderTop: '1px solid #e0e0e0', paddingTop: '15px' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '14px', fontWeight: 600 }}>📍 Or Add Single Date</h4>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                    <div className="date-input-group" style={{ flex: 1 }}>
                                        <label>Select date</label>
                                        <input
                                            type="date"
                                            id="singleDateInput"
                                            className="date-input-styled"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('singleDateInput');
                                            const date = input.value;
                                            if (date && !selectedDates.includes(date)) {
                                                setSelectedDates([...selectedDates, date]);
                                                input.value = '';
                                            }
                                        }}
                                        style={{ padding: '12px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    >
                                        ➕ Add
                                    </button>
                                </div>
                            </div>

                            {selectedDates.length > 0 && (
                                <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <strong style={{ fontSize: '14px' }}>Selected Dates ({selectedDates.length})</strong>
                                        <button
                                            onClick={() => setSelectedDates([])}
                                            style={{ padding: '4px 8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                        {selectedDates.sort().map(date => (
                                            <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'white', border: '1px solid #007bff', borderRadius: '4px', fontSize: '13px', color: '#007bff' }}>
                                                <span>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                <button
                                                    onClick={() => setSelectedDates(selectedDates.filter(d => d !== date))}
                                                    style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions-orange">
                            <button
                                onClick={() => {
                                    setShowSaveCalendar(false);
                                    setSelectedDates([]);
                                    setDateRangeStart('');
                                    setDateRangeEnd('');
                                }}
                                className="btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedDates.length === 0) {
                                        alert("⚠️ Please select at least one date!");
                                        return;
                                    }

                                    applyTemplateToSelectedDates(selectedDates);
                                }}
                                disabled={savingTemplate || selectedDates.length === 0}
                                className="btn-schedule"
                            >
                                {savingTemplate ? "Applying..." : `Schedule (${selectedDates.length} dates)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== NEW: EXPORT CALENDAR MODAL ========== */}
            {showExportCalendar && (
                <div className="dialog-backdrop">
                    <div className="calendar-modal-better">
                        <div className="modal-header-orange">
                            <div className="header-icon">📄</div>
                            <div>
                                <div className="header-title">Export Planning</div>
                                <div className="header-subtitle">Select date range to export</div>
                            </div>
                        </div>

                        <div className="date-picker-section">
                            <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '14px', fontWeight: 600 }}>📆 Add Date Range</h4>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <div className="date-input-group" style={{ flex: 1 }}>
                                    <label>Start date</label>
                                    <input
                                        type="date"
                                        value={dateRangeStart}
                                        onChange={(e) => {
                                            console.log("Start date changed:", e.target.value);
                                            setDateRangeStart(e.target.value);
                                        }}
                                        className="date-input-styled"
                                    />
                                </div>
                                <div className="date-input-group" style={{ flex: 1 }}>
                                    <label>End date</label>
                                    <input
                                        type="date"
                                        value={dateRangeEnd}
                                        onChange={(e) => {
                                            console.log("End date changed:", e.target.value);
                                            setDateRangeEnd(e.target.value);
                                        }}
                                        className="date-input-styled"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (!dateRangeStart || !dateRangeEnd) {
                                        alert("⚠️ Please select both start and end dates!");
                                        return;
                                    }

                                    const start = new Date(dateRangeStart);
                                    const end = new Date(dateRangeEnd);

                                    if (start > end) {
                                        alert("⚠️ Start date must be before end date!");
                                        return;
                                    }

                                    const newDates = [];
                                    const current = new Date(start);

                                    while (current <= end) {
                                        const dateStr = current.toISOString().split('T')[0];
                                        if (!selectedDates.includes(dateStr)) {
                                            newDates.push(dateStr);
                                        }
                                        current.setDate(current.getDate() + 1);
                                    }

                                    setSelectedDates([...selectedDates, ...newDates]);
                                    setDateRangeStart('');
                                    setDateRangeEnd('');
                                }}
                                className="add-range-btn"
                                style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                            >
                                ➕ Add Range
                            </button>

                            <div style={{ margin: '20px 0', borderTop: '1px solid #e0e0e0', paddingTop: '15px' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '14px', fontWeight: 600 }}>📍 Or Add Single Date</h4>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                    <div className="date-input-group" style={{ flex: 1 }}>
                                        <label>Select date</label>
                                        <input
                                            type="date"
                                            id="exportSingleDateInput"
                                            className="date-input-styled"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('exportSingleDateInput');
                                            const date = input.value;
                                            if (date && !selectedDates.includes(date)) {
                                                setSelectedDates([...selectedDates, date]);
                                                input.value = '';
                                            }
                                        }}
                                        style={{ padding: '12px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    >
                                        ➕ Add
                                    </button>
                                </div>
                            </div>

                            {selectedDates.length > 0 && (
                                <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <strong style={{ fontSize: '14px' }}>Selected Dates ({selectedDates.length})</strong>
                                        <button
                                            onClick={() => setSelectedDates([])}
                                            style={{ padding: '4px 8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                        {selectedDates.sort().map(date => (
                                            <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'white', border: '1px solid #007bff', borderRadius: '4px', fontSize: '13px', color: '#007bff' }}>
                                                <span>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                <button
                                                    onClick={() => setSelectedDates(selectedDates.filter(d => d !== date))}
                                                    style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions-orange">
                            <button
                                onClick={() => {
                                    setShowExportCalendar(false);
                                    setSelectedDates([]);
                                    setDateRangeStart('');
                                    setDateRangeEnd('');
                                }}
                                className="btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedDates.length === 0) {
                                        alert("⚠️ Please select at least one date!");
                                        return;
                                    }

                                    exportTemplateForSelectedDates(selectedDates);
                                }}
                                disabled={selectedDates.length === 0}
                                className="btn-schedule"
                            >
                                {`Export (${selectedDates.length} dates)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== NEW: IMPORT CALENDAR MODAL ========== */}
            {showImportCalendar && (
                <div className="dialog-backdrop">
                    <div className="calendar-modal" style={{ maxWidth: "500px" }}>
                        <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
                            📥 Import Planning from Date
                        </h3>

                        <div style={{ marginBottom: "30px" }}>
                            <p style={{ textAlign: "center", color: "#6c757d", marginBottom: "20px" }}>
                                Select a date to import its planning into the template
                            </p>

                            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                                <input
                                    type="date"
                                    value={importDate}
                                    onChange={(e) => setImportDate(e.target.value)}
                                    style={{
                                        padding: "12px",
                                        fontSize: "16px",
                                        borderRadius: "8px",
                                        border: "2px solid #007bff",
                                        textAlign: "center"
                                    }}
                                />

                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                                    <button
                                        className="preset-btn"
                                        onClick={() => {
                                            const today = new Date().toISOString().split('T')[0];
                                            setImportDate(today);
                                        }}
                                    >
                                        Today
                                    </button>
                                    <button
                                        className="preset-btn"
                                        onClick={() => {
                                            const yesterday = new Date();
                                            yesterday.setDate(yesterday.getDate() - 1);
                                            setImportDate(yesterday.toISOString().split('T')[0]);
                                        }}
                                    >
                                        Yesterday
                                    </button>
                                    <button
                                        className="preset-btn"
                                        onClick={() => {
                                            // Last Saturday
                                            const today = new Date();
                                            const currentDay = today.getDay();
                                            const diff = (currentDay + 1) % 7;
                                            const saturday = new Date(today);
                                            saturday.setDate(today.getDate() - diff);
                                            setImportDate(saturday.toISOString().split('T')[0]);
                                        }}
                                    >
                                        Last Saturday
                                    </button>
                                </div>
                            </div>

                            {importDate && (
                                <div style={{
                                    marginTop: "20px",
                                    padding: "15px",
                                    background: "#e7f3ff",
                                    borderRadius: "8px",
                                    textAlign: "center"
                                }}>
                                    <strong>Selected Date:</strong><br />
                                    {formatDateDisplay(importDate)}
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                            <button
                                className="cntbtn"
                                onClick={importPlanningFromDate}
                                disabled={!importDate}
                                style={{ backgroundColor: "#6f42c1", padding: "12px 24px", fontSize: "16px" }}
                            >
                                📥 Import Planning
                            </button>
                            <button
                                className="cntbtn"
                                onClick={() => {
                                    setShowImportCalendar(false);
                                    setImportDate('');
                                }}
                                style={{ backgroundColor: "#6c757d", padding: "12px 24px", fontSize: "16px" }}
                            >
                                Cancel
                            </button>
                        </div>

                        <div style={{
                            marginTop: "20px",
                            padding: "12px",
                            background: "#fff3cd",
                            borderRadius: "6px",
                            fontSize: "13px",
                            color: "#856404",
                            borderLeft: "4px solid #ffc107"
                        }}>
                            <strong>⚠️ Note:</strong> Importing will replace your current template with the planning from the selected date.
                        </div>
                    </div>
                </div>
            )}

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

                /* NEW: View Mode Tabs */
                .view-mode-tabs {
                    display: flex;
                    gap: 10px;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 10px;
                }

                .view-tab {
                    flex: 1;
                    padding: 15px 20px;
                    border: 2px solid #e0e0e0;
                    background: #f8f9fa;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-radius: 8px 8px 0 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .view-tab:hover {
                    background: #e9ecef;
                    border-color: #EB4219;
                }

                .view-tab.active {
                    background: white;
                    border-bottom: 2px solid white;
                    border-color: #EB4219;
                    color: #EB4219;
                    margin-bottom: -2px;
                }

                /* NEW: Template Info Banner */
                .template-info-banner {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 15px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }

                .banner-icon {
                    font-size: 24px;
                }

                /* NEW: Better Calendar Modal */
                .calendar-modal-better {
                    background: white;
                    border-radius: 12px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    overflow: hidden;
                }

                .modal-header-orange {
                    background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
                    color: white;
                    padding: 20px 25px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .header-icon {
                    font-size: 28px;
                    background: rgba(255,255,255,0.2);
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .header-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .header-subtitle {
                    font-size: 13px;
                    opacity: 0.9;
                }

                .date-picker-section {
                    padding: 20px 25px;
                    overflow-y: auto;
                    max-height: calc(90vh - 200px);
                }

                .date-inputs-row {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    margin-bottom: 15px;
                }

                .date-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .date-input-group label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                }

                .date-input-styled {
                    padding: 12px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: all 0.2s;
                    background: white;
                }

                .date-input-styled:focus {
                    outline: none;
                    border-color: #FF6B35;
                    box-shadow: 0 0 0 3px rgba(255,107,53,0.1);
                }

                .date-range-preview {
                    padding: 12px 15px;
                    background: #FFF4E6;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #8B4513;
                    text-align: center;
                }

                .modal-actions-orange {
                    padding: 20px 25px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .btn-cancel {
                    padding: 12px 24px;
                    background: white;
                    border: 2px solid #dee2e6;
                    border-radius: 8px;
                    color: #6c757d;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-cancel:hover {
                    background: #f8f9fa;
                    border-color: #adb5bd;
                }

                .btn-schedule {
                    padding: 12px 32px;
                    background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(255,107,53,0.3);
                }

                .btn-schedule:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(255,107,53,0.4);
                }

                .btn-schedule:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                /* OLD: Calendar Modal */
                .calendar-modal {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }

                .dialog-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .preset-btn {
                    padding: 8px 14px;
                    background: white;
                    color: #495057;
                    border: 2px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .preset-btn:hover {
                    background: #e9ecef;
                    border-color: #007bff;
                    color: #007bff;
                    transform: translateY(-1px);
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

                    .view-mode-tabs {
                        flex-direction: column;
                    }

                    .calendar-modal {
                        width: 95%;
                        padding: 20px;
                    }
                }
            `}</style>
        </>
    )
}