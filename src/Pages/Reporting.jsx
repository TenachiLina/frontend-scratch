import React, { useEffect, useState } from "react";
import Header from "../Components/Header";
import ReportingContent from "../Components/ReportingContent";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { employeesApi } from "../services/employeesAPI";
import { API_BASE_URL } from "../services/config";

// cache to avoid re-fetch
let employeesCache = null;

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

  /* ==================== FETCH EMPLOYEES ==================== */
  useEffect(() => {
    async function fetchData() {
      try {
        if (employeesCache) {
          setEmployees(employeesCache);
          if (employeesCache.length)
            setSelectedEmployeeId(employeesCache[0].emp_id || employeesCache[0].id);
          return;
        }
        const list = await employeesApi.getEmployees();
        employeesCache = list.map(emp => ({ ...emp, _visible: true }));
        setEmployees(employeesCache);
        if (list.length) setSelectedEmployeeId(list[0].emp_id || list[0].id);
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, []);

  /* ==================== DATE RANGE ==================== */
  const computeRange = () => {
    const ref = new Date(selectedDate);
    if (filterMode === "day") return { start: selectedDate, end: selectedDate };
    if (filterMode === "week") {
      const start = new Date(ref);
      const end = new Date(ref);
      end.setDate(start.getDate() + 6);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }
    if (filterMode === "month") {
      const start = new Date(ref);
      const end = new Date(ref);
      end.setDate(start.getDate() + 29);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }
    return { start: customStart, end: customEnd };
  };

  /* ==================== FETCH REPORT ==================== */
  const fetchReportRange = async () => {
    const { start, end } = computeRange();
    if (!start || !end) {
      setError("Please provide a valid date range.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `${API_BASE_URL}/api/worktime/report?start=${start}&end=${end}`
      );

      if (!response.ok) throw new Error("Failed to fetch report.");

      const data = await response.json();
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
      setError("Failed to load report.");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  /* ==================== TABLE DATA FILTER ==================== */
  const displayedRows = selectedEmployeeId
    ? rows.filter(r => r.emp_id === selectedEmployeeId)
    : rows;

  /* ==================== STYLES ==================== */
  const toggleButtonStyle = {
    position: "absolute",
    top: 6,
    right: 6,
    background: "#d97706",
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

  /* ==================== JSX ==================== */
  return (
    <>
      <Header />
      <div style={{ display: "flex", height: "calc(100vh - 80px)", background: "#fff3e0" }}>
        {/* FILTER PANEL */}
        <div
          style={{
            width: showFilters ? 180 : 50,
            borderRight: "1px solid #fbbf24",
            padding: showFilters ? 12 : 0,
            position: "relative",
            transition: "width 0.3s",
            background: "#fed7aa",
            overflowY: "auto",
          }}
        >
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{ ...toggleButtonStyle, transform: showFilters ? "rotate(0deg)" : "rotate(180deg)" }}
          >
            <FontAwesomeIcon icon={showFilters ? faChevronLeft : faChevronRight} />
          </button>

          {showFilters && (
            <div style={{ marginTop: 50 }}>
              <h4 style={{ fontSize: 14, marginBottom: 12, color: "#374151" }}>Filters</h4>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Range</label>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                style={{
                  width: "100%",
                  padding: 6,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  marginBottom: 10,
                  background: "#fff3e0",
                }}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="custom">Custom</option>
              </select>

              {filterMode === "custom" ? (
                <>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>Start</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{
                      width: "100%",
                      marginBottom: 8,
                      padding: 6,
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff3e0",
                    }}
                  />
                  <label style={{ fontSize: 12, color: "#6b7280" }}>End</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{
                      width: "100%",
                      marginBottom: 8,
                      padding: 6,
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff3e0",
                    }}
                  />
                </>
              ) : (
                <>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>Start Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      width: "100%",
                      marginBottom: 8,
                      padding: 6,
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff7ed",
                    }}
                  />
                </>
              )}

              <button
                onClick={fetchReportRange}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 8,
                  borderRadius: 8,
                  border: "none",
                  background: "#f97316",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
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
            borderRight: "1px solid #fbbf24",
            padding: showEmployees ? 12 : 0,
            position: "relative",
            transition: "width 0.3s",
            background: "#fed7aa",
            overflowY: "auto",
          }}
        >
          <button
            onClick={() => setShowEmployees(!showEmployees)}
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
                  background: "#fff7ed",
                }}
                onChange={(e) => {
                  const q = e.target.value.toLowerCase();
                  setEmployees((prev) =>
                    prev.map((emp) => ({ ...emp, _visible: (emp.name || "").toLowerCase().includes(q) }))
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
                      background: selectedEmployeeId === (emp.emp_id || emp.id) ? "#fed7aa" : "#fff7ed",
                      border: selectedEmployeeId === (emp.emp_id || emp.id) ? "1px solid #f97316" : "1px solid #d1d5db",
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
          {error && <div style={{ color: "#dc2626", marginBottom: 8 }}>{error}</div>}
          {loading && <div style={{ color: "#6b7280" }}>Loading...</div>}
          <ReportingContent
            rows={displayedRows}          // ✅ pass only selected employee rows
            summary={summary}
            startEnd={computeRange()}
            employeeList={employees}      // pass all employees for base_salary
          />
        </main>
      </div>
    </>
  );
}
