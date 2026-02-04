import React, { useEffect, useState, useMemo } from "react";

export default function ReportingContent({
    rows = [],
    summary = null,
    startEnd = { start: "", end: "" },
    employeeId = null,
    employeeList = [], // list of all employees with base_salary
    onSavedComment,
}) {
    console.log("Employee list passed to component:", employeeList);

    const [localRows, setLocalRows] = useState([]);
    const [advanceGiven, setAdvanceGiven] = useState(false);

    /* ================= FETCH ADVANCE FROM DB ================= */
    useEffect(() => {
        const fetchAdvance = async () => {
            if (!employeeId || !startEnd.start || !startEnd.end) return;
            try {
                const res = await fetch(`/api/advances/${employeeId}?start=${startEnd.start}&end=${startEnd.end}`);
                const data = await res.json();
                setAdvanceGiven(data.exists); // true if advance exists for this week
            } catch (err) {
                console.error("Error fetching advance:", err);
            }
        };
        fetchAdvance();
    }, [employeeId, startEnd]);

    /* ================= FILL MISSING DATES ================= */
    useEffect(() => {
        if (!rows || !startEnd?.start || !startEnd?.end) {
            setLocalRows([]);
            return;
        }

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

            return existing
                ? {
                    ...existing,
                    work_date: existing.work_date.toString().split("T")[0],
                    work_hours: existing.work_hours || null,
                    late_minutes: existing.late_minutes || 0,
                    overtime_minutes: existing.overtime_minutes || 0,
                    bonus: existing.bonus || 0,
                    penalty: existing.penalty || 0,
                    consommation: existing.consommation || 0,
                    salary: Number(existing.salary || 0),
                    advance_taken: existing.advance_taken || false,
                    is_empty: false,
                }
                : {
                    work_date: d,
                    work_hours: null,
                    late_minutes: 0,
                    overtime_minutes: 0,
                    bonus: 0,
                    penalty: 0,
                    consommation: 0,
                    salary: 0,
                    advance_taken: false,
                    is_empty: true,
                };
        });

        setLocalRows(filledRows);
    }, [rows, startEnd]);

    /* ================= CALCULATE SALARY FOR DAY ================= */
    const salaryForDay = (row) => {
        const empIdRow = Number(row.emp_id);
        const employee = employeeList.find((e) => Number(e.emp_id) === empIdRow);
        const baseSalary = Number(employee?.Base_salary || 0);
        const workHours = parseFloat(row.work_hours || 0);

        if (!baseSalary || !workHours) return { salary: "0.00", baseSalary };

        const hourlyRate = baseSalary / 8 / 26; // 8 hours/day, 26 days/month
        const salary = workHours * hourlyRate;

        return { salary: salary.toFixed(2), baseSalary };
    };

    /* ================= WEEK SUMMARY ================= */
    const weekSummary = useMemo(() => {
        if (!localRows.length) return { totalHours: 0, brutSalary: 0, netSalary: 0, advance: 0, hourlyRate: 0, totalLate: 0, totalConsommation: 0, totalPenalties: 0 };

        const firstRowWithEmp = localRows.find(r => r.emp_id);
        const empId = firstRowWithEmp ? Number(firstRowWithEmp.emp_id) : null;
        const employee = empId ? employeeList.find(e => Number(e.emp_id) === empId) : null;
        const baseSalary = Number(employee?.Base_salary || 0);

        const hourlyRate = baseSalary / 8 / 26;

        const totalHours = localRows.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
        const totalConsommation = localRows.reduce((sum, r) => sum + (parseFloat(r.consommation) || 0), 0);
        const totalLate = localRows.reduce((sum, r) => sum + (parseFloat(r.late_minutes) || 0), 0);
        const totalPenalties = localRows.reduce((sum, r) => sum + (parseFloat(r.penalty) || 0), 0);

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
        };
    }, [localRows, employeeList]);

    /* ================= MONTH SUMMARY ================= */
    /* ================= MONTH SUMMARY ================= */
    const monthSummary = useMemo(() => {
        if (!localRows.length) return { totalHours: 0, brutSalary: 0, netSalary: 0, advance: 0, hourlyRate: 0, totalLate: 0, totalConsommation: 0, totalPenalties: 0 };

        const firstRowWithEmp = localRows.find(r => r.emp_id);
        const empId = firstRowWithEmp ? Number(firstRowWithEmp.emp_id) : null;
        const employee = empId ? employeeList.find(e => Number(e.emp_id) === empId) : null;
        const baseSalary = Number(employee?.Base_salary || 0);

        const hourlyRate = baseSalary / 8 / 26;

        const totalHours = localRows.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
        const totalPenalties = localRows.reduce((sum, r) => sum + (parseFloat(r.penalty) || 0), 0);
        const totalAdvancesGiven = advanceGiven ? weekSummary.advance : 0; // ✅ include weekly advance checkbox
        const totalConsommation = localRows.reduce((sum, r) => sum + (parseFloat(r.consommation) || 0), 0);
        const totalLate = localRows.reduce((sum, r) => sum + (parseFloat(r.late_minutes) || 0), 0);

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
        };
    }, [localRows, employeeList, advanceGiven, weekSummary.advance]);


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

    const Card = ({ label, value, sub, children }) => (
        <div
            style={{
                background: "linear-gradient(135deg, #fed7aa, #fff3e0)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                textAlign: "center",
                transition: "transform 0.2s, box-shadow 0.2s",
                cursor: "default",
            }}
        >
            <div style={cardLabel}>{label}</div>
            <div style={cardValue}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: "#9ca3af" }}>{sub}</div>}
            {children}
        </div>
    );

    /* ================= HANDLE ADVANCE CHANGE ================= */
    const handleAdvanceChange = async (checked) => {
        if (!employeeId || !startEnd.start || !startEnd.end) return;
        try {
            const method = checked ? "POST" : "DELETE";
            const url = `/api/advances`;
            await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emp_id: employeeId,
                    start: startEnd.start,
                    end: startEnd.end,
                    amount: checked ? weekSummary.advance : 0,
                    reason: "Weekly advance",
                }),
            });
            if (onSavedComment) {
                onSavedComment({ start: startEnd.start, end: startEnd.end, advanceGiven: checked });
            }
        } catch (err) {
            console.error("Error updating advance:", err);
        }
    };

    const isReportReady = startEnd.start && startEnd.end && employeeId;

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
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 16, color: "#4b5563" }}>Detailed Report</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                        {startEnd.start} → {startEnd.end}
                    </div>
                </div>

                {isDayView ? (
                    /* ================= DAY VIEW ================= */
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                                    <Card label="Total Hours" value={`${weekSummary.totalHours} h`} />
                                    <Card label="Brut Salary" value={`${weekSummary.brutSalary} DA`} sub={`${weekSummary.hourlyRate} DA / hour`} />
                                    <Card label="Net Salary" value={`${weekSummary.netSalary} DA`} />
                                    <Card label="Advance" value={`${weekSummary.advance} DA`}>
                                        <label style={checkboxLabelStyle}>
                                            <input
                                                type="checkbox"
                                                checked={advanceGiven}
                                                onChange={async (e) => {
                                                    const checked = e.target.checked;
                                                    setAdvanceGiven(checked);
                                                    await handleAdvanceChange(checked);
                                                }}
                                            />
                                            Advance Given
                                        </label>
                                    </Card>
                                    <Card label="Total Late Minutes" value={`${weekSummary.totalLate || 0} min`} />
                                    <Card label="Total Consommation" value={`${weekSummary.totalConsommation || 0} DA`} />
                                    <Card label="Total Penalties" value={`${weekSummary.totalPenalties || 0} DA`} />
                                </>
                            ) : (
                                <>
                                    <Card label="Total Hours" value={`${monthSummary.totalHours} h`} />
                                    <Card label="Brut Salary" value={`${monthSummary.brutSalary} DA`} sub={`${monthSummary.hourlyRate} DA / hour`} />
                                    <Card label="Net Salary" value={`${monthSummary.netSalary} DA`} />
                                    <Card label="Total Late Minutes" value={`${monthSummary.totalLate || 0} min`} />
                                    <Card label="Total Consommation" value={`${monthSummary.totalConsommation || 0} DA`} />
                                    <Card label="Total Penalties" value={`${monthSummary.totalPenalties || 0} DA`} />
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
                                        {["Date", "Hours", "Late (min)", "Overtime", "Penalty", "Consommation"].map((h) => (
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
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: "center" }}>No data available</td>
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
