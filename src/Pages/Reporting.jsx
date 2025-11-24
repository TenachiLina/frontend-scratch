import React, { useEffect, useState } from "react";
import Header from "../Components/Header";
import ReportingContent from "../Components/ReportingContent";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { employeesApi } from "../services/employeesAPI";
import { worktimeApi } from "../services/worktimeAPI";
import { API_BASE_URL } from "../services/config";

export default function Reporting() {
  const todayISO = new Date().toISOString().split("T")[0];

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [filterMode, setFilterMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [showEmployees, setShowEmployees] = useState(true);


  //display list of employees:
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const list =
          (await employeesApi?.getEmployees?.()) ??
          (await fetch("${API_BASE_URL}/employees").then((r) => r.json()));

        setEmployees(list || []);
        if (list.length) setSelectedEmployeeId(list[0].emp_id || list[0].id);
      } catch (err) {
        console.error("Failed to load employees:", err);
      }
    };

    fetchEmployees();
  }, []);

  //another function for listing the employees
  useEffect(() => {
    (async () => {
      const list = await employeesApi.getEmployees();
      setEmployees(list);
      if (list.length) setSelectedEmployeeId(list[0].emp_id);
    })();
  }, []);

 
  //Display the selected period days(start, end)
  const computeRange = () => {
    if (filterMode === "day") return { start: selectedDate, end: selectedDate };

    const ref = new Date(selectedDate);

    if (filterMode === "week") {
      const start = new Date(ref);
      const end = new Date(ref);
      end.setDate(ref.getDate() + 6);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }

    if (filterMode === "month") {
      const start = new Date(ref);
      const end = new Date(start);
      end.setDate(start.getDate() + 29);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }

    return { start: customStart, end: customEnd };
  };

  // Helper: generate all days between start and end
  const generateDateRange = (start, end) => {
    const dates = [];
    let current = new Date(start);
    const last = new Date(end);

    while (current <= last) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const fetchReportRange = async () => {
    if (!selectedEmployeeId) return;

    const { start, end } = computeRange();

    if (!start || !end) {
      setError("Please provide a valid date range.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/worktime/report?start=${start}&end=${end}&empId=${selectedEmployeeId}`
      );

      const data = await response.json();

      if (!data || !data.rows) {
        setRows([]);
        setSummary(null);
        return;
      }

      const normalizedRows = data.rows.map((r) => ({
        work_date: r.work_date || "",
        work_hours: r.work_hours || null,
        late_minutes: r.late_minutes || 0,
        overtime_minutes: r.overtime_minutes || 0,
        bonus: r.bonus || 0,
        penalty: r.penalty || 0,
        consommation: r.consommation || 0,
        comment: r.comment || "",
        salary: Number(r.salary || 0), 
        emp_id: r.emp_id || null,
        work_time_id: r.worktime_id || null,
      }));

      setRows(normalizedRows);
      setSummary(data.summary || null);
      setError("");
    } catch (err) {
      console.error("Failed to fetch report:", err);
      setError("Failed to load report for selected range.");
      setRows([]);
      setSummary(null);
    }
  };

  const toggleButtonStyle = {
    position: "absolute",
    top: 6,
    right: 6,
    background: "linear-gradient(135deg,#ff7b00,#ff4b00)",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: 32,
    height: 32,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
    zIndex: 5,
    transition: "transform 0.2s",
  };



  return (
    <>
      <Header />
      <div style={{ display: "flex", height: "calc(100vh - 80px)", background: "#f9fafb" }}>
        {/* FILTER PANEL */}
        <div
          style={{
            width: showFilters ? 180 : 50,
            borderRight: "1px solid #e5e7eb",
            padding: showFilters ? 12 : 0,
            position: "relative",
            transition: "width 0.3s",
            background: "#fff",
            boxShadow: showFilters ? "2px 0 6px rgba(0,0,0,0.05)" : "none",
            overflow: "visible",
          }}
        >
          {/* create a button to display right side forms, used to select period and dates. */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? "Hide Filters" : "Show Filters"}
            style={{ ...toggleButtonStyle, transform: showFilters ? "rotate(0deg)" : "rotate(180deg)" }}
          >
            <FontAwesomeIcon icon={showFilters ? faChevronLeft : faChevronRight} />
          </button>

          {showFilters && (
            <div style={{ marginTop: 50 }}>
              {/* Drop down list to select filter(week, day, month) */}
              <h4 style={{ fontSize: 14, marginBottom: 12, color: "#374151" }}>Filters</h4>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Range</label>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                style={{ width: "100%", padding: 6, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 10, background: "#fff" }}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="custom">Custom</option>
              </select>
              
              {/* Text field to select the started date if the period isn't custome, else text field for both start and end*/}
              {filterMode === "custom" ? (
                <>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>Start</label>
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ width: "100%", marginBottom: 8, padding: 6, borderRadius: 8, border: "1px solid #d1d5db" }} />
                  <label style={{ fontSize: 12, color: "#6b7280" }}>End</label>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ width: "100%", marginBottom: 8, padding: 6, borderRadius: 8, border: "1px solid #d1d5db" }} />
                </>
              ) : (
                <>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>Start Date</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: "100%", marginBottom: 8, padding: 6, borderRadius: 8, border: "1px solid #d1d5db" }} />
                </>
              )}

              {/* Implement the button that will launch the report generation (Apply)*/}
              <button
                onClick={fetchReportRange}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 8,
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg,#ff7b00,#ff4b00)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                  transition: "background 0.3s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "linear-gradient(135deg,#ff9a42,#ff6b00)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "linear-gradient(135deg,#ff7b00,#ff4b00)")}
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* EMPLOYEE PANEL */}
        <aside
          style={{
            width: showEmployees ? 220 : 50,
            borderRight: "1px solid #e5e7eb",
            padding: showEmployees ? 12 : 0,
            position: "relative",
            transition: "width 0.3s",
            background: "#FFF0DD",
            boxShadow: showEmployees ? "2px 0 6px rgba(0,0,0,0.05)" : "none",
            overflow: "visible",
          }}
        >
          <button
            onClick={() => setShowEmployees(!showEmployees)}
            title={showEmployees ? "Hide Employees" : "Show Employees"}
            style={{ ...toggleButtonStyle, transform: showEmployees ? "rotate(0deg)" : "rotate(180deg)" }}
          >
            <FontAwesomeIcon icon={showEmployees ? faChevronLeft : faChevronRight} />
          </button>

          {showEmployees && (
            <div style={{ marginTop: 50 }}>
              <input
                placeholder="Search employee..."
                style={{
                  width: "100%",
                  padding: 8,
                  marginBottom: 12,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                }}
                onChange={(e) => {
                  const q = e.target.value.toLowerCase();
                  setEmployees((prev) =>
                    prev.map((emp) => ({
                      ...emp,
                      _visible: (emp.name || "").toLowerCase().includes(q),
                    }))
                  );
                }}
              />
              {employees
                .filter((emp) => emp._visible !== false)
                .map((emp) => (
                  <div
                    key={emp.emp_id || emp.id}
                    onClick={() => setSelectedEmployeeId(emp.emp_id || emp.id)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      marginBottom: 6,
                      cursor: "pointer",
                      background: selectedEmployeeId === (emp.emp_id || emp.id) ? "#ffe9d6" : "#fff",
                      border: selectedEmployeeId === (emp.emp_id || emp.id) ? "1px solid #ff7b00" : "1px solid #e5e7eb",
                      boxShadow: selectedEmployeeId === (emp.emp_id || emp.id) ? "0 2px 6px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    <strong>{emp.name}</strong>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>#{emp.emp_id}</div>
                  </div>
                ))}
            </div>
          )}
        </aside>

        {/* MAIN REPORT */}
        <main style={{ flex: 1, padding: 20 }}>
          {error && <div style={{ color: "#ef4444", marginBottom: 8 }}>{error}</div>}
          {loading && <div style={{ color: "#6b7280" }}>Loading...</div>}
          <ReportingContent
            rows={rows}
            summary={summary}
            startEnd={computeRange()}
            employeeId={selectedEmployeeId}
            onSavedComment={() => fetchReportRange()}
          />
        </main>
      </div>
    </>
  );
}
