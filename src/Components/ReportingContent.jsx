import { useEffect, useState, useMemo } from "react";
import { API_BASE_URL } from "../services/config";

export default function ReportingContent({
    rows = [],
    summary = null,
    startEnd = { start: "", end: "" },
    employeeId = null,
    employeeList = [],
    onSavedComment,
    isGlobalView = false,
}) {
    // console.log("rows",rows);
    // console.log("summary: ",summary);
    // console.log("employeeId: ",employeeId);
    // console.log("start is:",startEnd.start);  
    // console.log("End is:",startEnd.end);
    // console.log("isGlobale view",isGlobalView);

    const [localRows, setLocalRows] = useState([]);
    const [advanceGiven, setAdvanceGiven] = useState(false);
    const [isLoadingAdvance, setIsLoadingAdvance] = useState(false);

    /* ================= FETCH ADVANCE FROM DB ================= */
    useEffect(() => {
        const fetchAdvance = async () => {
            console.log("🟢 fetchAdvance running for:", { employeeId, start: startEnd.start, end: startEnd.end });

            if (!employeeId || !startEnd.start || !startEnd.end) {
                console.log("🟡 No employee/dates, setting advanceGiven to false");
                setAdvanceGiven(false);
                return;
            }

            setIsLoadingAdvance(true);
            try {
                const url = `${API_BASE_URL}/api/advances/${employeeId}?start=${startEnd.start}&end=${startEnd.end}`;
                console.log("🟢 Fetching from:", url);
                const res = await fetch(url);

                if (res.ok) {
                    const data = await res.json();
                    console.log("🟢 Fetch result:", data);
                    const hasAdvance = data && (data.exists || (Array.isArray(data) && data.length > 0));
                    setAdvanceGiven(hasAdvance);
                } else {
                    console.log("🟡 No advance found or endpoint missing");
                    setAdvanceGiven(false);
                }
            } catch (err) {
                console.error("❌ Error fetching advance:", err);
                setAdvanceGiven(false);
            } finally {
                setIsLoadingAdvance(false);
            }
        };

        fetchAdvance();
    }, [employeeId, startEnd.start, startEnd.end]);

    /* ================= FILL MISSING DATES ================= */
    useEffect(() => {
        if (!rows || !startEnd?.start || !startEnd?.end) {
            setLocalRows([]);
            return;
        }

        if (isGlobalView) {
            setLocalRows(rows.map(r => ({
                ...r,
                work_date: r.work_date ? r.work_date.toString().split("T")[0] : "",
                work_hours: r.work_hours || null,
                late_minutes: r.late_minutes || 0,
                overtime_minutes: r.overtime_minutes || 0,
                penalty: r.penalty || 0,
                consommation: r.consommation || 0,
                salary: Number(r.salary || 0),
                advance_taken: r.advance_taken || false,
                absent: r.absent || 0,
                absent_comment: r.absent_comment || "",
                is_empty: false,
            })));
            return;
        }

        // const isDayView = startEnd.start === startEnd.end;
        // if (isDayView) {
        //     // Pour day view, utilisez directement les rows sans remplissage
        //     setLocalRows(rows.map(r => ({
        //         ...r,
        //         work_date: r.work_date ? r.work_date.toString().split("T")[0] : "",
        //         work_hours: r.work_hours || null,
        //         late_minutes: r.late_minutes || 0,
        //         overtime_minutes: r.overtime_minutes || 0,
        //         penalty: r.penalty || 0,
        //         consommation: r.consommation || 0,
        //         salary: Number(r.salary || 0),
        //         advance_taken: r.advance_taken || false,
        //         absent: r.absent || 0,
        //         absent_comment: r.absent_comment || "",
        //         is_empty: false,
        //     })));
        //     return;
        // }

        const generateDates = (start, end) => {
            const dates = [];
            let current = new Date(start);
            const last = new Date(end);
            while (current <= last) {
                const yyyy = current.getFullYear();
                const mm = String(current.getMonth() + 1).padStart(2, "0");
                const dd = String(current.getDate()).padStart(2, "0");
                dates.push(`${yyyy}-${mm}-${dd}`);
                current.setDate(current.getDate() + 1);
            }
            return dates;
        };

        const allDates = generateDates(startEnd.start, startEnd.end);

        const filledRows = allDates.map((d) => {
            const existing = rows.find((r) => {
                const rowDate = r.work_date ? r.work_date.toString().split("T")[0] : "";
                return rowDate === d;
            });
            // console.log("🌤️🌤️🌤️ rowdate for date", d, ":", existing);
            return existing
                ? {
                    ...existing,
                    work_date: existing.work_date.toString().split("T")[0],
                    work_hours: existing.work_hours || null,
                    late_minutes: existing.late_minutes || 0,
                    overtime_minutes: existing.overtime_minutes || 0,
                    penalty: existing.penalty || 0,
                    consommation: existing.consommation || 0,
                    salary: Number(existing.salary || 0),
                    advance_taken: existing.advance_taken || false,
                    absent: existing.absent || 0,
                    absent_comment: existing.absent_comment || "",
                    is_empty: false,
                }
                : {
                    work_date: d,
                    work_hours: null,
                    late_minutes: 0,
                    overtime_minutes: 0,
                    penalty: 0,
                    consommation: 0,
                    salary: 0,
                    advance_taken: false,
                    absent: 0,
                    absent_comment: "",
                    is_empty: true,
                };
        });
        // console.log("📊 Final filledRows:", filledRows);

        setLocalRows(filledRows);
    }, [rows, startEnd, isGlobalView]);

    /* ================= HELPER: CONVERT TIME TO DECIMAL HOURS ================= */
    const timeToDecimalHours = (timeStr) => {
        if (!timeStr || timeStr === "00:00" || timeStr === "00:00:00" || timeStr === "") return 0;
        if (typeof timeStr === 'number') return timeStr;

        const str = String(timeStr).trim();

        // If it's already a decimal number
        if (!str.includes(':')) {
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        }

        // Handle HH:MM:SS format (from database)
        const parts = str.split(':');

        if (parts.length === 3) {
            // HH:MM:SS format
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            const seconds = parseInt(parts[2], 10);

            if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;

            return hours + (minutes / 60) + (seconds / 3600);
        } else if (parts.length === 2) {
            // HH:MM format
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);

            if (isNaN(hours) || isNaN(minutes)) return 0;

            return hours + (minutes / 60);
        }

        return 0;
    };
    /* ================= CALCULATE SALARY FOR DAY ================= */
    const salaryForDay = (row) => {
        const empIdRow = Number(row.emp_id);
        const employee = employeeList.find((e) => Number(e.emp_id) === empIdRow);
        const baseSalary = Number(employee?.Base_salary || 0);
        const workHours = timeToDecimalHours(row.work_hours);

        if (!baseSalary || workHours === 0) return { salary: "0.00", baseSalary };

        const hourlyRate = baseSalary / 8 / 26;
        const salary = workHours * hourlyRate;

        return { salary: salary.toFixed(2), baseSalary };
    };

    /* ================= GLOBAL SUMMARY (ALL EMPLOYEES) ================= */
    const globalSummary = useMemo(() => {
        if (!isGlobalView || !localRows.length) return null;

        const employeeGroups = {};
        localRows.forEach(row => {
            const empId = row.emp_id;
            if (!employeeGroups[empId]) {
                employeeGroups[empId] = [];
            }
            employeeGroups[empId].push(row);
        });

        let totalHours = 0;
        let totalBrutSalary = 0;
        let totalConsommation = 0;
        let totalLate = 0;
        let totalPenalties = 0;
        let totalBaseSalary = 0;
        let totalAdvances = 0;
        let totalAbsences = 0;

        Object.keys(employeeGroups).forEach(empId => {
            const empRows = employeeGroups[empId];
            const employee = employeeList.find(e => Number(e.emp_id) === Number(empId));
            const baseSalary = Number(employee?.Base_salary || 0);
            const hourlyRate = baseSalary / 8 / 26;

            const empHours = empRows.reduce((sum, r) => sum + timeToDecimalHours(r.work_hours || "00:00"), 0);
            const empConsommation = empRows.reduce((sum, r) => sum + (parseFloat(r.consommation) || 0), 0);
            const empLate = empRows.reduce((sum, r) => sum + (parseFloat(r.late_minutes) || 0), 0);
            const empPenalties = empRows.reduce((sum, r) => sum + (parseFloat(r.penalty) || 0), 0);
            const empAbsences = empRows.reduce((sum, r) => sum + (r.absent ? 1 : 0), 0);
            const empBrutSalary = empHours * hourlyRate;
            const empNetSalary = empBrutSalary - empConsommation - empPenalties;
            const empAdvance = empNetSalary / 2;

            totalHours += empHours;
            totalBrutSalary += empBrutSalary;
            totalConsommation += empConsommation;
            totalLate += empLate;
            totalPenalties += empPenalties;
            totalBaseSalary += baseSalary;
            totalAdvances += empAdvance;
            totalAbsences += empAbsences;
        });

        const netSalary = totalBrutSalary - totalConsommation - totalPenalties;

        return {
            totalHours: totalHours.toFixed(2),
            brutSalary: totalBrutSalary.toFixed(2),
            netSalary: netSalary.toFixed(2),
            totalLate: totalLate.toFixed(0),
            totalConsommation: totalConsommation.toFixed(2),
            totalPenalties: totalPenalties.toFixed(2),
            totalBaseSalary: totalBaseSalary.toFixed(2),
            totalAdvances: totalAdvances.toFixed(2),
            totalAbsences: totalAbsences,
            employeeCount: Object.keys(employeeGroups).length,
        };
    }, [localRows, employeeList, isGlobalView]);

    /* ================= WEEK SUMMARY ================= */
    const weekSummary = useMemo(() => {
        if (!localRows.length || isGlobalView) return { totalHours: 0, brutSalary: 0, netSalary: 0, advance: 0, hourlyRate: 0, totalLate: 0, totalConsommation: 0, totalPenalties: 0, totalAbsences: 0 };

        const firstRowWithEmp = localRows.find(r => r.emp_id);
        const empId = firstRowWithEmp ? Number(firstRowWithEmp.emp_id) : null;
        const employee = empId ? employeeList.find(e => Number(e.emp_id) === empId) : null;
        const baseSalary = Number(employee?.Base_salary || 0);

        const hourlyRate = baseSalary / 8 / 26;

        const totalHours = localRows.reduce((sum, r) => sum + timeToDecimalHours(r.work_hours || "00:00"), 0);
        const totalConsommation = localRows.reduce((sum, r) => sum + (parseFloat(r.consommation) || 0), 0);
        const totalLate = localRows.reduce((sum, r) => sum + (parseFloat(r.late_minutes) || 0), 0);
        const totalPenalties = localRows.reduce((sum, r) => sum + (parseFloat(r.penalty) || 0), 0);
        const totalAbsences = localRows.reduce((sum, r) => sum + (r.absent ? 1 : 0), 0);

        const brutSalary = totalHours * hourlyRate;
        const netSalary = brutSalary - totalConsommation;
        const advance = netSalary / 2;

        return {
            totalHours: totalHours.toFixed(2),
            brutSalary: brutSalary.toFixed(2),
            netSalary: netSalary.toFixed(2),
            advance: advance.toFixed(2),
            hourlyRate: hourlyRate.toFixed(2),
            totalLate,
            totalConsommation,
            totalPenalties,
            totalAbsences,
        };
    }, [localRows, employeeList, isGlobalView]);

    /* ================= MONTH SUMMARY ================= */
    const monthSummary = useMemo(() => {
        if (!localRows.length || isGlobalView) return { totalHours: 0, brutSalary: 0, netSalary: 0, advance: 0, hourlyRate: 0, totalLate: 0, totalConsommation: 0, totalPenalties: 0, totalAbsences: 0 };

        const firstRowWithEmp = localRows.find(r => r.emp_id);
        const empId = firstRowWithEmp ? Number(firstRowWithEmp.emp_id) : null;
        const employee = empId ? employeeList.find(e => Number(e.emp_id) === empId) : null;
        const baseSalary = Number(employee?.Base_salary || 0);

        const hourlyRate = baseSalary / 8 / 26;

        const totalHours = localRows.reduce((sum, r) => sum + timeToDecimalHours(r.work_hours || "00:00"), 0);
        const totalPenalties = localRows.reduce((sum, r) => sum + (parseFloat(r.penalty) || 0), 0);
        const totalAdvancesGiven = advanceGiven ? parseFloat(weekSummary.advance) : 0;
        const totalConsommation = localRows.reduce((sum, r) => sum + (parseFloat(r.consommation) || 0), 0);
        const totalLate = localRows.reduce((sum, r) => sum + (parseFloat(r.late_minutes) || 0), 0);
        const totalAbsences = localRows.reduce((sum, r) => sum + (r.absent ? 1 : 0), 0);

        const brutSalary = totalHours * hourlyRate;
        const netSalary = brutSalary - totalPenalties - totalAdvancesGiven - totalConsommation;
        const advance = netSalary / 2;

        return {
            totalHours: totalHours.toFixed(2),
            brutSalary: brutSalary.toFixed(2),
            netSalary: netSalary.toFixed(2),
            advance: advance.toFixed(2),
            hourlyRate: hourlyRate.toFixed(2),
            totalLate,
            totalConsommation,
            totalPenalties,
            totalAbsences,
        };
    }, [localRows, employeeList, advanceGiven, weekSummary.advance, isGlobalView]);

    const isDayView = startEnd.start === startEnd.end;

    const cardsContainerStyle = {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginBottom: 20,
    };

    const checkboxLabelStyle = {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
    };

    const Card = ({ label, value, sub, children, highlight = false }) => (
        <div
            style={{
                background: highlight
                    ? "linear-gradient(135deg, #fb923c, #f97316)"
                    : "linear-gradient(135deg, #fed7aa, #fff3e0)",
                borderRadius: 12,
                padding: 20,
                boxShadow: highlight
                    ? "0 6px 20px rgba(251, 146, 60, 0.4)"
                    : "0 4px 12px rgba(0,0,0,0.1)",
                textAlign: "center",
                transition: "transform 0.2s, box-shadow 0.2s",
                cursor: "default",
                border: highlight ? "2px solid #ea580c" : "none",
            }}
        >
            <div style={{
                ...cardLabel,
                color: highlight ? "#fff" : "#6b7280",
                fontWeight: highlight ? 600 : 400,
            }}>{label}</div>
            <div style={{
                ...cardValue,
                color: highlight ? "#fff" : "#111827",
                fontSize: highlight ? 26 : 22,
            }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: highlight ? "#fed7aa" : "#9ca3af" }}>{sub}</div>}
            {children}
        </div>
    );

    const StatCard = ({ icon, label, value, color = "#f97316" }) => (
        <div
            style={{
                background: "#fff",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                border: `2px solid ${color}`,
                textAlign: "center",
                transition: "transform 0.3s, box-shadow 0.3s",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.18)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
        >
            <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 8, fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: color }}>{value}</div>
        </div>
    );

    /* ================= HANDLE ADVANCE CHANGE ================= */
    const handleAdvanceChange = async (checked) => {
        console.log("🔵 handleAdvanceChange called with:", checked);

        if (!employeeId || !startEnd.start || !startEnd.end) {
            console.log("❌ Missing required data, returning early");
            return;
        }

        setAdvanceGiven(checked);

        try {
            const method = checked ? "POST" : "DELETE";
            const url = checked
                ? `${API_BASE_URL}/api/advances`
                : `${API_BASE_URL}/api/advances/${employeeId}`;

            if (checked) {
                const requestBody = {
                    emp_id: employeeId,
                    amount: parseFloat(weekSummary.advance),
                    date: startEnd.start,
                    reason: `Weekly advance (${startEnd.start} to ${startEnd.end})`,
                };

                const response = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
                    throw new Error(`Failed to update advance: ${JSON.stringify(errorData)}`);
                }
            } else {
                const response = await fetch(url, { method });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
                    throw new Error(`Failed to update advance: ${JSON.stringify(errorData)}`);
                }
            }

            if (onSavedComment) {
                onSavedComment({
                    start: startEnd.start,
                    end: startEnd.end,
                    advanceGiven: checked,
                    employeeId
                });
            }
        } catch (err) {
            console.error("❌ Error updating advance:", err);
            setAdvanceGiven(!checked);
            alert("Failed to update advance. Please try again.");
        }
    };

    /* ================= GROUP ROWS BY EMPLOYEE (FOR GLOBAL VIEW) ================= */
    const groupedByEmployee = useMemo(() => {
        if (!isGlobalView) return {};

        const groups = {};
        localRows.forEach(row => {
            const empId = row.emp_id;
            if (!groups[empId]) {
                const employee = employeeList.find(e => Number(e.emp_id) === Number(empId));
                groups[empId] = {
                    employee,
                    rows: []
                };
            }
            groups[empId].rows.push(row);
        });

        return groups;
    }, [localRows, employeeList, isGlobalView]);

    return (
        <div
            style={{
                backgroundColor: "#fff3e0",
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                justifyContent: "center",
                paddingTop: 20,
                paddingBottom: 40,
            }}
        >
            <div
                style={{
                    padding: 20,
                    borderRadius: 12,
                    background: "#fff3e0",
                    width: "100%",
                    maxWidth: 1400,
                }}
            >
                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    {isGlobalView && (
                        <div style={{
                            background: "linear-gradient(135deg, #f97316, #ea580c)",
                            padding: "16px 24px",
                            borderRadius: 12,
                            marginBottom: 16,
                            boxShadow: "0 8px 24px rgba(249, 115, 22, 0.3)",
                        }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 32 }}>📊</span>
                                Global Statistics - All Employees
                            </div>
                            <div style={{ fontSize: 14, color: "#fed7aa", marginTop: 4 }}>
                                Comprehensive overview of company performance
                            </div>
                        </div>
                    )}
                    {!isGlobalView && (
                        <>
                            <div style={{ fontSize: 16, color: "#4b5563" }}>Detailed Report</div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                                {startEnd.start} → {startEnd.end}
                            </div>
                        </>
                    )}
                </div>

                {/* ================= GLOBAL VIEW ================= */}
                {isGlobalView ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* Financial Overview */}
                        <div style={{
                            background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
                            borderRadius: 16,
                            padding: 24,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        }}>
                            <h3 style={{
                                fontSize: 20,
                                fontWeight: 700,
                                marginBottom: 20,
                                color: "#ea580c",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                                <span>💼</span> Financial Overview
                            </h3>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: 20,
                            }}>
                                <StatCard
                                    icon="✅"
                                    label="Total Net Salary"
                                    value={`${globalSummary?.netSalary || 0} DA`}
                                    color="#059669"
                                />
                                <StatCard
                                    icon="⚡"
                                    label="Total Advances"
                                    value={`${globalSummary?.totalAdvances || 0} DA`}
                                    color="#dc2626"
                                />
                                <StatCard
                                    icon="🍽️"
                                    label="Total Consommation"
                                    value={`${globalSummary?.totalConsommation || 0} DA`}
                                    color="#ea580c"
                                />
                                <StatCard
                                    icon="⚠️"
                                    label="Total Penalties"
                                    value={`${globalSummary?.totalPenalties || 0} DA`}
                                    color="#dc2626"
                                />
                            </div>
                        </div>

                        {/* Key Metrics - Highlighted */}
                        <div style={{
                            background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
                            borderRadius: 16,
                            padding: 24,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        }}>
                            <h3 style={{
                                fontSize: 20,
                                fontWeight: 700,
                                marginBottom: 20,
                                color: "#ea580c",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                                <span>🎯</span> Key Metrics
                            </h3>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: 20,
                            }}>
                                <StatCard
                                    icon="👥"
                                    label="Total Employees"
                                    value={globalSummary?.employeeCount || 0}
                                    color="#3b82f6"
                                />
                                <StatCard
                                    icon="⏰"
                                    label="Total Hours Worked"
                                    value={`${globalSummary?.totalHours || 0} h`}
                                    color="#8b5cf6"
                                />
                                <StatCard
                                    icon="💰"
                                    label="Total Base Salary"
                                    value={`${globalSummary?.totalBaseSalary || 0} DA`}
                                    color="#10b981"
                                />
                                <StatCard
                                    icon="💵"
                                    label="Total Brut Salary"
                                    value={`${globalSummary?.brutSalary || 0} DA`}
                                    color="#f59e0b"
                                />
                            </div>
                        </div>


                        {/* Performance Indicators */}
                        <div style={{
                            background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
                            borderRadius: 16,
                            padding: 24,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        }}>
                            <h3 style={{
                                fontSize: 20,
                                fontWeight: 700,
                                marginBottom: 20,
                                color: "#ea580c",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                                <span>📈</span> Performance Indicators
                            </h3>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: 20,
                            }}>
                                <StatCard
                                    icon="⏱️"
                                    label="Total Late Minutes"
                                    value={`${globalSummary?.totalLate || 0} min`}
                                    color="#f59e0b"
                                />
                                <StatCard
                                    icon="🏖️"
                                    label="Total Absences"
                                    value={`${globalSummary?.totalAbsences || 0}`}
                                    color="#dc2626"
                                />
                                <StatCard
                                    icon="📊"
                                    label="Avg Hours per Employee"
                                    value={`${globalSummary?.employeeCount > 0 ? (parseFloat(globalSummary?.totalHours || 0) / globalSummary?.employeeCount).toFixed(2) : 0} h`}
                                    color="#6366f1"
                                />
                                <StatCard
                                    icon="💎"
                                    label="Avg Salary per Employee"
                                    value={`${globalSummary?.employeeCount > 0 ? (parseFloat(globalSummary?.brutSalary || 0) / globalSummary?.employeeCount).toFixed(2) : 0} DA`}
                                    color="#8b5cf6"
                                />
                            </div>
                        </div>

                        {/* Employees Breakdown */}
                        <div style={{ marginTop: 8 }}>
                            <h3 style={{
                                fontSize: 20,
                                fontWeight: 700,
                                marginBottom: 16,
                                color: "#374151",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                                <span>👤</span> Individual Employee Details
                            </h3>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
                                gap: 16,
                            }}>
                                {Object.keys(groupedByEmployee).map(empId => {
                                    const { employee, rows: empRows } = groupedByEmployee[empId];
                                    const baseSalary = Number(employee?.Base_salary || 0);
                                    const hourlyRate = baseSalary / 8 / 26;

                                    const empHours = empRows.reduce((sum, r) => sum + timeToDecimalHours(r.work_hours || "00:00"), 0);
                                    const empConsommation = empRows.reduce((sum, r) => sum + (parseFloat(r.consommation) || 0), 0);
                                    const empPenalties = empRows.reduce((sum, r) => sum + (parseFloat(r.penalty) || 0), 0);
                                    const empAbsences = empRows.reduce((sum, r) => sum + (r.absent ? 1 : 0), 0);
                                    const empBrutSalary = empHours * hourlyRate;
                                    const empNetSalary = empBrutSalary - empConsommation - empPenalties;
                                    const empAdvance = empNetSalary / 2;

                                    return (
                                        <div
                                            key={empId}
                                            style={{
                                                border: "2px solid #fb923c",
                                                padding: 20,
                                                borderRadius: 12,
                                                background: "linear-gradient(135deg, #fff, #fff7ed)",
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                                transition: "transform 0.2s, box-shadow 0.2s",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = "translateY(-2px)";
                                                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = "translateY(0)";
                                                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                                            }}
                                        >
                                            <div style={{
                                                fontSize: 18,
                                                fontWeight: 700,
                                                marginBottom: 12,
                                                color: "#ea580c",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                            }}>
                                                <span>👤</span>
                                                {employee?.name || `Employee #${empId}`}
                                            </div>
                                            <div style={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 1fr",
                                                gap: 10,
                                                fontSize: 13,
                                                color: "#4b5563",
                                            }}>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Base Salary:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#10b981", marginTop: 4 }}>
                                                        {baseSalary.toFixed(2)} DA
                                                    </div>
                                                </div>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Hours:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#8b5cf6", marginTop: 4 }}>
                                                        {empHours.toFixed(2)} h
                                                    </div>
                                                </div>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Brut Salary:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#f59e0b", marginTop: 4 }}>
                                                        {empBrutSalary.toFixed(2)} DA
                                                    </div>
                                                </div>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Net Salary:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#059669", marginTop: 4 }}>
                                                        {empNetSalary.toFixed(2)} DA
                                                    </div>
                                                </div>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Advance:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#dc2626", marginTop: 4 }}>
                                                        {empAdvance.toFixed(2)} DA
                                                    </div>
                                                </div>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Consommation:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#ea580c", marginTop: 4 }}>
                                                        {empConsommation.toFixed(2)} DA
                                                    </div>
                                                </div>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Penalties:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#dc2626", marginTop: 4 }}>
                                                        {empPenalties.toFixed(2)} DA
                                                    </div>
                                                </div>
                                                <div style={{ padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #fed7aa" }}>
                                                    <strong style={{ color: "#6b7280" }}>Absences:</strong>
                                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#dc2626", marginTop: 4 }}>
                                                        {empAbsences} {empAbsences === 1 ? 'day' : 'days'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : isDayView ? (
                    /* ================= DAY VIEW ================= */
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* ✅ AJOUTEZ CE DEBUG */}
                        {console.log("📅 DAY VIEW - localRows:", localRows)}
                        {console.log("📅 DAY VIEW - employeeId:", employeeId)}
                        {console.log("📅 DAY VIEW - employeeList:", employeeList)}
                        {localRows.map((r, idx) => {
                            const { salary } = salaryForDay(r);
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        border: "1px solid hsl(36, 73%, 47%)",
                                        padding: 16,
                                        borderRadius: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                    }}
                                >
                                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14 }}>
                                        <div><strong>Worked Hours:</strong> {r.work_hours} h</div>
                                        <div><strong>Late Minutes:</strong> {r.late_minutes} min</div>
                                        <div><strong>Overtime Minutes:</strong> {r.overtime_minutes} min</div>
                                        <div><strong>Penalty:</strong> {r.penalty} DA</div>
                                        <div><strong>Consomation:</strong> {r.consommation} DA</div>
                                        <div><strong>Absent:</strong> {r.absent ? 'Yes' : 'No'}</div>
                                        {r.absent_comment && <div><strong>Comment:</strong> {r.absent_comment}</div>}
                                    </div>
                                    <div style={{ marginTop: 8, fontWeight: 600, fontSize: 14 }}>
                                        <div><strong>Salary for Day:</strong> {salary} DA</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ================= WEEK / MONTH VIEW ================= */
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* ================= CARDS ================= */}
                        <div style={cardsContainerStyle}>
                            {new Date(startEnd.end) - new Date(startEnd.start) < 7 * 24 * 60 * 60 * 1000 ? (
                                <>
                                    <Card label="Brut Salary" value={`${weekSummary.brutSalary} DA`} sub={`${weekSummary.hourlyRate} DA / hour`} />
                                    <Card label="Net Salary" value={`${weekSummary.netSalary} DA`} />
                                    <Card label="Advance" value={`${weekSummary.advance} DA`}>
                                        <label style={checkboxLabelStyle}>
                                            <input
                                                type="checkbox"
                                                checked={advanceGiven}
                                                disabled={isLoadingAdvance}
                                                onChange={(e) => {
                                                    handleAdvanceChange(e.target.checked);
                                                }}
                                            />
                                            Advance Given {isLoadingAdvance && "(loading...)"}
                                        </label>
                                    </Card>
                                    <Card label="Total Hours" value={`${weekSummary.totalHours} h`} />
                                    <Card label="Total Late Minutes" value={`${weekSummary.totalLate || 0} min`} />
                                    <Card label="Total Consommation" value={`${weekSummary.totalConsommation || 0} DA`} />
                                    <Card label="Total Penalties" value={`${weekSummary.totalPenalties || 0} DA`} />
                                    <Card label="Total Absences" value={`${weekSummary.totalAbsences || 0}`} />
                                </>
                            ) : (
                                <>
                                    <Card label="Total Hours" value={`${monthSummary.totalHours} h`} />
                                    <Card label="Brut Salary" value={`${monthSummary.brutSalary} DA`} sub={`${monthSummary.hourlyRate} DA / hour`} />
                                    <Card label="Net Salary" value={`${monthSummary.netSalary} DA`} />
                                    <Card label="Total Late Minutes" value={`${monthSummary.totalLate || 0} min`} />
                                    <Card label="Total Consommation" value={`${monthSummary.totalConsommation || 0} DA`} />
                                    <Card label="Total Penalties" value={`${monthSummary.totalPenalties || 0} DA`} />
                                    <Card label="Total Absences" value={`${monthSummary.totalAbsences || 0} `} />
                                </>
                            )}
                        </div>

                        {/* ================= TABLE ================= */}
                        <div
                            style={{
                                overflowX: "auto",
                                overflowY: "auto",
                                maxHeight: 400,
                                borderRadius: 12,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                                background: "#fff7ed",
                            }}
                        >
                            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                                <thead style={{ background: "#fed7aa" }}>
                                    <tr>
                                        {["Date", "Hours", "Late (min)", "Overtime", "Penalty", "Consommation", "Absent"].map((h) => (
                                            <th key={h} style={{ padding: 12, textAlign: "center", fontWeight: 600, color: "#374151", width: h === "Date" ? "200px" : "auto" }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {localRows && localRows.length ? (
                                        localRows.map((r, idx) => {
                                            const isEmpty = r.is_empty;
                                            const workDateStr = r.work_date;
                                            const dateObj = new Date(workDateStr + "T00:00:00");
                                            const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                                            const formattedDate = `${weekday}, ${workDateStr}`;

                                            return (
                                                <tr key={r.worktime_id || idx} style={{ background: isEmpty ? "#fff3e0" : "#fff7ed" }}>
                                                    <td style={{ padding: "10px", fontWeight: 600 }}>{formattedDate}</td>
                                                    <td style={{ textAlign: "center" }}>{r.work_hours ? `${r.work_hours}h` : "—"}</td>
                                                    <td style={{ textAlign: "center" }}>{r.late_minutes || 0}</td>
                                                    <td style={{ textAlign: "center" }}>{r.overtime_minutes || 0}</td>
                                                    <td style={{ textAlign: "center" }}>{r.penalty || 0}</td>
                                                    <td style={{ textAlign: "center" }}>{r.consommation || 0}</td>
                                                    <td style={{ textAlign: "center", color: r.absent ? "#dc2626" : "#10b981", fontWeight: r.absent ? 600 : 400 }}>
                                                        {r.absent ? "Yes" : ""}
                                                        {r.absent && r.absent_comment && (
                                                            <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic", marginTop: 2 }}>
                                                                {r.absent_comment}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: "center", padding: 20 }}>No data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const cardLabel = {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
};

const cardValue = {
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
};