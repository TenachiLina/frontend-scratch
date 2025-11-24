import { useState, useEffect } from "react";
import Header from "../Components/Header";
import Profile from "../assets/profileImg.jpg";
import { employeesApi } from "../services/employeesAPI";

export default function Emp_Management() {
  const [showForm, setShowForm] = useState(false);
  
  const [employees, setEmployees] = useState([]);
  const [isEditing, setIsEditing] = useState(false);   
  const [editingId, setEditingId] = useState(null);    

  const [employeeForm, setEmployeeForm] = useState({
    personal_image: null,
    name: "",
    Total_hours: "",
    Base_salary: "",
    address: "",
    phone_number: "",
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const data = await employeesApi.getEmployees();
      setEmployees(data);
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
        // ✅ Editing existing employee
        await employeesApi.updateEmployee(editingId, employeeForm);
        alert("✅ Employee updated successfully");
      } else {
        // ✅ Check for duplicates
        const isDuplicate = employees.some(
          (emp) =>
            emp.name.trim().toLowerCase() === employeeForm.name.trim().toLowerCase() &&
            emp.phone_number.trim() === employeeForm.phone_number.trim()
        );

        if (isDuplicate) {
          alert("⚠️ This employee already exists in the table!");
          return; // Stop saving
        }

        // ✅ Adding new employee
        await employeesApi.addEmployee(employeeForm);
        alert("✅ Employee added successfully");
      }

      setShowForm(false);
      setIsEditing(false);
      setEditingId(null);

      // ✅ Reset form
      setEmployeeForm({
        personal_image: null,
        name: "",
        Total_hours: "",
        Base_salary: "",
        address: "",
        phone_number: "",
      });

      fetchEmployees(); // ✅ refresh table
    } catch (error) {
      alert("❌ Failed to save employee");
    }
  }

  // ✅ DELETE
  async function handleDelete(emp_id) {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    try {
      await employeesApi.deleteEmployee(emp_id);
      alert("✅ Employee deleted");
      setEmployees((prev) => prev.filter((e) => e.emp_id !== emp_id));
    } catch {
      alert("❌ Failed to delete employee");
    }
  }

  // ✅ EDIT FUNCTION
  function handleEdit(emp) {
    setIsEditing(true);
    setEditingId(emp.emp_id);

    setEmployeeForm({
      personal_image: null, // image optional
      name: emp.name,
      Total_hours: emp.Total_hours,
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
                name: "",
                Total_hours: "",
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
                <th>Photo</th>
                <th>Full Name</th>
                <th>Salary Per Hour</th>
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
                    <td>
                      <img
                        src={emp.photoUrl ? emp.photoUrl : Profile}
                        alt={emp.name}
                        style={{ width: "50px", borderRadius: "50%" }}
                      />
                    </td>
                    <td>{emp.name}</td>
                    <td>{emp.Total_hours}</td>
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

        {/* ✅ Drawer Form */}
        {showForm && (
          <div className="drawer">
            <div className="drawer-content">
              <h3>{isEditing ? "Edit Employee" : "Add Employee"}</h3>

              <form onSubmit={(e) => e.preventDefault()}>
                <label>Personal Image:</label>
                <input
                  type="file"
                  name="personal_image"
                  accept="image/*"
                  onChange={handleChange}
                />

                <label>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={employeeForm.name}
                  onChange={handleChange}
                />

                <label>Salary Per Hour:</label>
                <input
                  type="number"
                  name="Total_hours"
                  value={employeeForm.Total_hours}
                  onChange={handleChange}
                />

                <label>Base Salary:</label>
                <input
                  type="number"
                  name="Base_salary"
                  value={employeeForm.Base_salary}
                  onChange={handleChange}
                />

                <label>Address:</label>
                <input
                  type="text"
                  name="address"
                  value={employeeForm.address}
                  onChange={handleChange}
                />

                <label>Phone:</label>
                <input
                  type="text"
                  name="phone_number"
                  value={employeeForm.phone_number}
                  onChange={handleChange}
                />

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




