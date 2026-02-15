import { useState, useEffect } from "react";
import Header from "../AuthContext/Header";
import Profile from "../assets/ProfileImg.jpg";
import { employeesApi } from "../services/employeesAPI";

// Module-level cache (persists while the tab is open)
let employeesCache = null;

export default function Emp_Management() {
  const [showForm, setShowForm] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [employeeForm, setEmployeeForm] = useState({
    emp_number: "",
    personal_image: null,
    FirstName: "",
    LastName:"",
    Base_salary: "",
    address: "",
    phone_number: "",
  });

  useEffect(() => {
    // If we have cache in this session, use it and skip network call
    if (employeesCache) {
      setEmployees(employeesCache);
      return;
    }
    // otherwise fetch from API
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const data = await employeesApi.getEmployees();
      setEmployees(data);
      employeesCache = data; // store in module-level cache
    } catch (error) {
      alert("❌ Failed to load employees");
    }
  }

  function handleChange(e) {
    const { name, value, files } = e.target;
    setEmployeeForm((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  }

  async function handleSave() {
    try {
      if (isEditing) {
        // Update existing employee on server
        const updated = await employeesApi.updateEmployee(editingId, employeeForm);
        //Tell the reporting page After adding or deleting
        localStorage.setItem("employees_updated", Date.now()); // just a timestamp


        // Update local state & cache:
        setEmployees((prev) => {
          const newList = prev.map((emp) =>
            emp.emp_id === editingId ? (updated && updated.emp_id ? updated : { ...emp, ...employeeForm }) : emp
          );
          employeesCache = newList;
          return newList;
        });
      } else {
        let duplicateMessages = [];

        // Check employee number
        const empNumberDuplicate = employees.some(
          (emp) => emp.emp_number === Number(employeeForm.emp_number)
        );
        if (empNumberDuplicate) duplicateMessages.push("Employee number");

        // Check name + phone combination
        const namePhoneDuplicate = employees.some(
          (emp) =>
            emp.FirstName?.trim().toLowerCase() === employeeForm.FirstName.trim().toLowerCase() &&
            emp.LastName?.trim().toLowerCase() === employeeForm.LastName.trim().toLowerCase() &&
            emp.phone_number?.trim() === employeeForm.phone_number.trim()
        );

        if (namePhoneDuplicate) duplicateMessages.push("Full Name & Phone");

        // If any duplicates found, alert
        if (duplicateMessages.length > 0) {
          alert(`⚠️ Duplicate found in: ${duplicateMessages.join(", ")} ⚠️`);
          return;
        }

        // Add on server
        const created = await employeesApi.addEmployee(employeeForm);
        //Tell the reporting page After adding or deleting
        localStorage.setItem("employees_updated", Date.now()); // just a timestamp

        // If API returned created employee, append it. Otherwise fallback to re-fetch.
        if (created && created.emp_id) {
          setEmployees((prev) => {
            const newList = [...prev, created];
            employeesCache = newList;
            return newList;
          });
        } else {
          // safe fallback: re-fetch from server and update cache (should be rare)
          await fetchEmployees();
        }
      }

      // Reset UI
      setShowForm(false);
      setIsEditing(false);
      setEditingId(null);
      setEmployeeForm({
        emp_number: "",
        personal_image: null,
        FirstName: "",
        LastName:"",
        Base_salary: "",
        address: "",
        phone_number: "",
      });
    } catch (error) {
      console.error(error);
      alert("❌ Failed to save employee");
    }
  }

  // DELETE
  async function handleDelete(emp_id) {
  // Ask user for confirmation first
  const confirmed = window.confirm("⚠️ Are you sure you want to delete this employee?");

  if (!confirmed) return; // User canceled

  try {
    await employeesApi.deleteEmployee(emp_id);

    // Tell reporting page after adding or deleting
    localStorage.setItem("employees_updated", Date.now()); // just a timestamp

    // Update local state and cache
    setEmployees((prev) => {
      const newList = prev.filter((e) => e.emp_id !== emp_id);
      employeesCache = newList;
      return newList;
    });

    // Show success confirmation
    alert("✅ Employee deleted successfully!");
  } catch (error) {
    console.error(error);
    alert("❌ Failed to delete employee");
  }
  }


  // EDIT
  function handleEdit(emp) {
    setIsEditing(true);
    setEditingId(emp.emp_id);

    setEmployeeForm({
      emp_number: emp.emp_number,
      personal_image: null, // image optional
      FirstName: emp.FirstName,
      LastName: emp.LastName,
      Base_salary: emp.Base_salary,
      address: emp.address,
      phone_number: emp.phone_number,
    });

    setShowForm(true);
  }

  return (
    <>
      <Header />

      <div className="employee-management-container">
        <div className="employee-header">
          <h2>Employees Management</h2>

          <button
            className="add-btn"
            onClick={() => {
              setShowForm(true);
              setIsEditing(false);
              setEditingId(null);
              setEmployeeForm({
                personal_image: null,
                emp_number: "",
                FirstName: "",
                LastName: "",
                Base_salary: "",
                address: "",
                phone_number: "",
              });
            }}
          >
            + Add Employee
          </button>
        </div>

        <div className="employee-management">
          <table>
            <thead>
              <tr>
                <th>Employee number</th>
                <th>Photo</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Base Salary</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.emp_id}>
                    <td>{emp.emp_number}</td>
                    <td>
                      <img
                        src={emp.photoUrl ? emp.photoUrl : Profile}
                        alt={emp.name}
                        style={{ width: "50px", borderRadius: "50%" }}
                      />
                    </td>
                    <td>{emp.FirstName}</td>
                    <td>{emp.LastName}</td>
                    <td>{emp.Base_salary}</td>
                    <td>{emp.address}</td>
                    <td>{emp.phone_number}</td>
                    <td>
                      <button className="editbtn" onClick={() => handleEdit(emp)}>
                        Edit
                      </button>
                      <button className="deletebtn" onClick={() => handleDelete(emp.emp_id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Drawer Form */}
        {showForm && (
          <div className="drawer">
            <div className="drawer-content">
              <h3>{isEditing ? "Edit Employee" : "Add Employee"}</h3>

              <form onSubmit={(e) => e.preventDefault()}>
                <label>Employee Number:</label>
                <input type="number" name="emp_number" value={employeeForm.emp_number} onChange={handleChange} />

                <label>Personal Image:</label>
                <input type="file" name="personal_image" accept="image/*" onChange={handleChange} />

                <label>First Name:</label>
                <input type="text" name="FirstName" value={employeeForm.FirstName} onChange={handleChange} />

                <label>Last Name:</label>
                <input type="text" name="LastName" value={employeeForm.LastName} onChange={handleChange} />

                <label>Base Salary:</label>
                <input type="number" name="Base_salary" value={employeeForm.Base_salary} onChange={handleChange} />

                <label>Address:</label>
                <input type="text" name="address" value={employeeForm.address} onChange={handleChange} />

                <label>Phone:</label>
                <input type="text" name="phone_number" value={employeeForm.phone_number} onChange={handleChange} />


                <div className="form-actions">
                  <button type="button" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSave}>
                    {isEditing ? "Save Changes" : "Save"}
                  </button>
                </div>
              </form>
            </div>

            <div className="drawer-overlay" onClick={() => setShowForm(false)} />
          </div>
        )}
      </div>
    </>
  );
}




