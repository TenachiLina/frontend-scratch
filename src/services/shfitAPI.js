import { API_BASE_URL } from "./config";

export const shiftApi = {
  // GET all shifts
  // getShifts: async () => {
  //   try {
  //     const response = await fetch(`${API_BASE_URL}/api/shifts`);
  //     if (!response.ok) throw new Error("Failed to fetch shifts");

  //     return await response.json();
  //   } catch (error) {
  //     console.error("Failed to fetch shifts:", error);
  //     return [];
  //   }
  // },
  getShifts: async () => {
  try {
    const url = `${API_BASE_URL}/api/shifts`;
    console.log("🌐 Fetching shifts from URL:", url); // <-- log the URL
    const response = await fetch(url);

    if (!response.ok) throw new Error("Failed to fetch shifts");

    const data = await response.json();
    console.log("💾 Shifts received:", data); // <-- log the response data
    return data;
  } catch (error) {
    console.error("Failed to fetch shifts:", error);
    return [];
  }
  },


  // POST: Add a new shift
  addShift: async (shift) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shift),
      });

      if (!response.ok) throw new Error("Failed to add shift");

      return await response.json();
    } catch (error) {
      console.error("Failed to add shift:", error);
      return null;
    }
  },

  // DELETE: Remove a shift
  deleteShift: async (shiftId) => {
    try {
      console.log(shiftId)
      const response = await fetch(`${API_BASE_URL}/api/shifts/${shiftId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete shift");

      return true;
    } catch (error) {
      console.error("Failed to delete shift:", error);
      return false;
    }
  },

  // PUT: Update a shift
  updateShift: async (shiftId, payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shifts/${shiftId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Failed to update shift");

    return await response.json();
  } catch (error) {
    console.error("Failed to update shift:", error);
    return null;
  }
}

};
