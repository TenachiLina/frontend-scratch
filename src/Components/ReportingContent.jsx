import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../services/config";


export default function ReportingContent({
    rows = [],
    summary = null,
    startEnd = { start: "", end: "" },
    employeeId = null,
    onSavedComment = () => { },
}) {
    const [localRows, setLocalRows] = useState([]);

    useEffect(() => {
        if (!rows || !startEnd?.start || !startEnd?.end) {
            setLocalRows([]);
            return;
        }

        // Generate all dates between start and end as strings YYYY-MM-DD
        const generateDates = (start, end) => {
            const dates = [];
            let current = new Date(start);
            const last = new Date(end);
            while (current <= last) {
                // Convert to YYYY-MM-DD in local timezone without touching ISO string
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
                // Treat work_date as string directly from DB
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
                    comment: existing.comment || "",
                    salary: existing.salary || 0,
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
                    comment: "",
                    salary: 0,
                    is_empty: true,
                };
        });

        setLocalRows(filledRows);
    }, [rows, startEnd]);


    const toggleAdvance = (index) => {
        setLocalRows((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], advance_taken: !copy[index].advance_taken };
            return copy;
        });
    };

    const toHHMM = (val) => {
        if (val == null) return "-";
        if (typeof val === "string" && val.includes(":")) return val;
        const m = Number(val || 0);
        const h = Math.floor(m / 60);
        const mm = m % 60;
        return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
    };

    const computedSummary = useMemo(() => {
        if (summary) return summary;
        const s = {
            total_hours_minutes: 0,
            total_delay_minutes: 0,
            total_overtime_minutes: 0,
            total_consommation: 0,
            total_bonus: 0,
            total_penalty: 0,
            total_salary: 0,
            count_late: 0,
            count_early: 0,
        };
        for (const r of localRows) {
            const hm = r.work_hours && typeof r.work_hours === "string" && r.work_hours.includes(":");
            s.total_hours_minutes += hm
                ? r.work_hours.split(":").reduce((acc, val, i) => acc + Number(val) * (i === 0 ? 60 : 1), 0)
                : Number(r.work_hours || r.work_minutes || 0);
            s.total_delay_minutes += Number(r.late_minutes || r.delay_minutes || 0);
            s.total_overtime_minutes += Number(r.overtime_minutes || 0);
            s.total_consommation += Number(r.consommation || 0);
            s.total_bonus += Number(r.bonus || 0);
            s.total_penalty += Number(r.penalty || 0);
            s.total_salary += Number(r.salary || 0);
            if (Number(r.late_minutes || 0) > 0) s.count_late += 1;
            if (Number(r.early_minutes || 0) > 0) s.count_early += 1;
        }
        return s;
    }, [localRows, summary]);

    const handleCommentChange = (index, value) => {
        setLocalRows((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], comment: value };
            return copy;
        });
    };

    const saveComment = async (row) => {
        try {
            await fetch(`${API_BASE_URL}/worktime/${row.worktime_id}`, {

                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comment: row.comment || "" }),
            });
            alert("Comment saved!");
            onSavedComment(); // refresh report
        } catch (err) {
            console.error(err);
            alert("Failed to save comment");
        }
    };


    const isDayView = startEnd.start === startEnd.end;

    return (
        <div
            style={{
                backgroundColor: "#fff",
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
                    background: "#fff",
                    width: "100%",
                    maxWidth: 1400,
                }}
            >
                {/* Header */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 16, color: "#6b7280" }}>Detailed Report</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                        {startEnd.start} → {startEnd.end}
                    </div>
                </div>

                {/* DAY VIEW (No table) */}
                {isDayView ? (
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 12,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                            padding: 20,
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                        }}
                    >
                        {(() => {
                            const r = localRows[0] || {};
                            const isLate = Number(r.late_minutes || r.delay_minutes || 0) > 0;
                            const isEarly = Number(r.early_minutes || 0) > 0;
                            const cons = Number(r.consommation || 0);

                            const fields = [
                                // ["Date", r.date || r.work_date || "-"],
                                ["Hours", toHHMM(r.work_hours || r.work_minutes)],
                                ["Late/Early", isLate ? "Late" : isEarly ? "Early" : "-"],
                                ["Late (min)", r.late_minutes || r.delay_minutes || 0],
                                ["Overtime", r.overtime_minutes || 0],
                                ["Bonus", r.bonus || 0],
                                ["Penalty", r.penalty || 0],
                                ["Consommation", cons || 0],
                            ];

                            return (
                                <>
                                    {fields.map(([label, value]) => (
                                        <div
                                            key={label}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "8px 12px",
                                                borderRadius: 8,
                                                background: "#f9fafb",
                                            }}
                                        >
                                            <div style={{ color: "#6b7280", fontSize: 14 }}>{label}</div>
                                            <div style={{ fontWeight: 600, color: "#111827" }}>{value}</div>
                                        </div>
                                    ))}

                                    {/* Comment */}
                                    <div
                                        style={{
                                            gridColumn: "1 / span 2",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                            marginTop: 12,
                                        }}
                                    >
                                        <div style={{ color: "#6b7280", fontSize: 14 }}>Comment</div>
                                        <input
                                            value={r.comment || ""}
                                            onChange={(e) => handleCommentChange(0, e.target.value)}
                                            placeholder="Add comment..."
                                            style={{
                                                padding: 8,
                                                borderRadius: 8,
                                                border: "1px solid #d1d5db",
                                                outline: "none",
                                                width: "100%",
                                            }}
                                        />
                                    </div>

                                    {/* Save Button */}
                                    <div style={{ gridColumn: "1 / span 2", textAlign: "right" }}>
                                        <button
                                            onClick={() => saveComment(localRows[0] || {})}
                                            style={{
                                                padding: "8px 16px",
                                                borderRadius: 8,
                                                background: "linear-gradient(90deg,#ff7b00,#ff4b00)",
                                                color: "#fff",
                                                fontWeight: 600,
                                                border: "none",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                ) : (
                    /* WEEK / MONTH VIEW (TABLE) */
                    <div
                        style={{
                            overflowX: "auto",
                            borderRadius: 12,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                            background: "#fff",
                        }}
                    >
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "separate",
                                borderSpacing: 0,
                            }}
                        >
                            <thead style={{ background: "#f3f4f6" }}>
                                <tr>
                                    {[
                                        "Date",
                                        "Hours",
                                        "Late/Early",
                                        "Late (min)",
                                        "Overtime",
                                        "Bonus",
                                        "Penalty",
                                        "Consommation",
                                        "Comment",
                                        "Save",
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: 12,
                                                textAlign: "center",
                                                fontWeight: 600,
                                                color: "#374151",
                                                width: h === "Date" ? "200px" : "auto", // 👈 wider Date column
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {localRows && localRows.length ? (
                                    localRows.map((r, idx) => {
                                        const isEmpty = r.is_empty;
                                        const workDateStr = r.work_date; // already like "2025-11-01"
                                        const dateObj = new Date(workDateStr + "T00:00:00");
                                        const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                                        const formattedDate = `${weekday}, ${workDateStr}`;

                                        return (
                                            <tr key={r.worktime_id || idx} style={{ background: isEmpty ? "#f8fafc" : "#fff" }}>

                                                <td style={{ padding: "10px", fontWeight: 600 }}>{formattedDate}</td>
                                                <td style={{ textAlign: "center" }}>{r.work_hours ? `${r.work_hours}h` : "—"}</td>
                                                <td style={{ textAlign: "center" }}>
                                                    {r.late_minutes > 0 ? "Late" : r.overtime_minutes > 0 ? "Overtime" : "—"}
                                                </td>
                                                <td style={{ textAlign: "center" }}>{r.late_minutes || 0}</td>
                                                <td style={{ textAlign: "center" }}>{r.overtime_minutes || 0}</td>
                                                <td style={{ textAlign: "center" }}>{r.bonus || 0}</td>
                                                <td style={{ textAlign: "center" }}>{r.penalty || 0}</td>
                                                <td style={{ textAlign: "center" }}>{r.consommation || 0}</td>
                                                <td style={{ textAlign: "center" }}>
                                                    <input
                                                        value={r.comment || ""}
                                                        onChange={(e) => handleCommentChange(idx, e.target.value)}
                                                        placeholder="Add comment..."
                                                        style={{ width: "100%", padding: 6, borderRadius: 8, border: "1px solid #d1d5db" }}
                                                    />
                                                </td>
                                                <td style={{ textAlign: "center" }}>
                                                    {!isEmpty && (
                                                        <button onClick={() => saveComment(r)} style={{ padding: "6px 12px", borderRadius: 8, background: "#0ea5e9", color: "#fff" }}>
                                                            Save
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: "center" }}>
                                            No data available
                                        </td>
                                    </tr>
                                )}
                            </tbody>

                        </table>

                    </div>
                )}

                {/* Summary Cards */}
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                        marginTop: 20,
                    }}
                >
                    {[
                        { label: "Late count", value: computedSummary.count_late, color: "#ef4444" },
                        { label: "Early count", value: computedSummary.count_early, color: "#22c55e" },
                        { label: "Salary", value: computedSummary.total_salary + " DA", color: "#2563eb" },
                        {
                            label: "Advance",
                            value: (localRows[0]?.salary ? localRows[0].salary / 2 : 0) + " DA",
                            toggle: localRows[0]?.advance_taken,
                        },
                    ].map((card, idx) => (
                        <div
                            key={idx}
                            style={{
                                background: "#fff",
                                padding: 16,
                                borderRadius: 12,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                                minWidth: 140,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                cursor: card.toggle !== undefined ? "pointer" : "default",
                            }}
                            onClick={() => {
                                if (card.toggle !== undefined) toggleAdvance(0);
                            }}
                        >
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{card.label}</div>
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: 18,
                                    marginTop: 4,
                                    color: card.color || "#374151",
                                }}
                            >
                                {card.value}
                            </div>
                            {card.toggle !== undefined && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        width: 50,
                                        height: 26,
                                        borderRadius: 20,
                                        background: card.toggle ? "#22c55e" : "#d1d5db",
                                        position: "relative",
                                        transition: "background 0.3s",
                                    }}
                                >
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 3,
                                            left: card.toggle ? 26 : 3,
                                            width: 20,
                                            height: 20,
                                            borderRadius: "50%",
                                            background: "#fff",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                            transition: "left 0.3s",
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
