// const API_BASE_URL = 'http://localhost:3001/api';
import { API_BASE_URL } from './config';


export const employeesApi = {

  async getEmployees() {
    try {
      console.log("🟢 Fetching employees from:", `${API_BASE_URL}/api/employees`);
      const response = await fetch(`${API_BASE_URL}/api/employees`);

      console.log("🟡 Response status:", response.status);
      const text = await response.text();
      console.log("🟣 Raw response text:", text);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = JSON.parse(text);
      console.log("✅ Parsed employees:", data);
      return data;
    } catch (error) {
      console.error("❌ Error fetching employees:", error);
      throw error;
    }
  },



  async deleteEmployee(employeeId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  },

  async addEmployee(employeeData) {
  try {
    const formData = new FormData();

    if (employeeData.personal_image) {
      formData.append("personal_image", employeeData.personal_image);
    }
    formData.append("FirstName", employeeData.FirstName);
    formData.append("LastName", employeeData.LastName);
    formData.append("Base_salary", employeeData.Base_salary);
    formData.append("address", employeeData.address);
    formData.append("phone_number", employeeData.phone_number);
    formData.append("emp_number", employeeData.emp_number);
    console.log("form data appended")
    
    const response = await fetch(`${API_BASE_URL}/api/employees`, {
      method: "POST",
      body: formData, // ✅ no JSON, no headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
},

async updateEmployee(employeeId, employeeData) {
  try {
    const formData = new FormData();

    formData.append("emp_number", employeeData.emp_number);
    if (employeeData.personal_image)
    formData.append("personal_image", employeeData.personal_image);
    formData.append("FirstName", employeeData.FirstName);
    formData.append("LastName", employeeData.LastName);
    formData.append("Base_salary", employeeData.Base_salary);
    formData.append("address", employeeData.address);
    formData.append("phone_number", employeeData.phone_number);

    const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
      method: "PUT",
      body: formData,
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("Error updating employee:", err);
    throw err;
  }
}

};





