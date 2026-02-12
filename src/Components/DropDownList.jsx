import { useState, useEffect } from "react";

export default function DropDownList({ employees, onSelect, selectedEmployee }) {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

    useEffect(() => {
        if (selectedEmployee) {
            setSelectedEmployeeId(selectedEmployee.emp_id);
        } else {
            setSelectedEmployeeId("");
        }
    }, [selectedEmployee]);

    const handleChange = (e) => {
    const selectedId = e.target.value;
    setSelectedEmployeeId(selectedId);
    
    // ✅ Vérifier que selectedId n'est pas vide
    if (!selectedId) {
        if (onSelect) {
            onSelect(null);
        }
        return;
    }
    
    // ✅ Convertir en nombre si emp_id est un nombre
    const employee = employees.find(emp => emp.emp_id === Number(selectedId));
    
    console.log("Selected employee:", employee); // Debug
    
    if (onSelect) {
        onSelect(employee);
    }
   };

   
    return (
        <select
            value={selectedEmployeeId}
            onChange={handleChange}
            style={{
                width: "100%",
                padding: "5px",
                borderRadius: "5px",
                maxHeight: "150px",
                overflowY: "auto",
            }}
        >
            <option value="">Select Employee</option>
            {employees.map((employee) => (
                <option key={employee.emp_id} value={employee.emp_id}>
                    {employee.FirstName} {employee.LastName}
                </option>
            ))}
        </select>
    );
}
