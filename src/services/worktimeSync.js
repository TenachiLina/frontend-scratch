// Utility functions for syncing worktime data across pages using ONLY localStorage

// Save worktime to localStorage and trigger sync
export const saveWorktimeToLocalStorage = (empId, date, shiftId, clockIn, clockOut, absent = false, absentComment = "") => {
  const key = `worktime_${empId}_${date}_${shiftId}`;
  const data = {
    clockIn: clockIn || "00:00",
    clockOut: clockOut || "00:00",
    shift: shiftId,
    absent: absent,
    absentComment: absentComment,
    timestamp: Date.now()
  };
  
  console.log(`🔥 SAVING TO LOCALSTORAGE:`, key, data);
  localStorage.setItem(key, JSON.stringify(data));
  
  // Set a sync trigger with timestamp to notify other pages
  const syncTrigger = Date.now().toString();
  localStorage.setItem('worktime_sync_trigger', syncTrigger);
  console.log(`🔥 SET SYNC TRIGGER:`, syncTrigger);
  
  // Trigger custom event for same-tab components
  const customEvent = new CustomEvent('worktimeUpdated', {
    detail: { empId, shiftId, date, clockIn, clockOut, absent, absentComment }
  });
  window.dispatchEvent(customEvent);
  console.log(`🔥 DISPATCHED CUSTOM EVENT:`, customEvent.detail);
  
  // Also dispatch a simpler event
  window.dispatchEvent(new Event('worktime-changed'));
  console.log(`🔥 DISPATCHED SIMPLE EVENT: worktime-changed`);
};

// Load worktime from localStorage
export const loadWorktimeFromLocalStorage = (empId, date, shiftId) => {
  const key = `worktime_${empId}_${date}_${shiftId}`;
  const data = localStorage.getItem(key);
  
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing localStorage data:', e);
      return null;
    }
  }
  
  return null;
};

// Load all worktime records for a specific date
export const loadAllWorktimeForDate = (date) => {
  const worktimeData = {};
  
  console.log(`📦 LOADING ALL WORKTIME FOR DATE: ${date}`);
  
  // Scan localStorage for all worktime entries for this date
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('worktime_') && key.includes(`_${date}_`)) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        // Extract empId and shiftId from key format: worktime_empId_date_shiftId
        const parts = key.split('_');
        if (parts.length >= 4) {
          const empId = parts[1];
          const shiftId = parts[3];
          const stateKey = `${empId}-${shiftId}`;
          worktimeData[stateKey] = {
            clockIn: data.clockIn || "00:00",
            clockOut: data.clockOut || "00:00",
            absent: data.absent || false,
            absentComment: data.absentComment || ""
          };
          console.log(`   ✅ Found: ${key} → ${stateKey}`, data);
        }
      } catch (e) {
        console.error('Error parsing worktime data:', e);
      }
    }
  }
  
  console.log(`📦 LOADED ${Object.keys(worktimeData).length} RECORDS:`, worktimeData);
  return worktimeData;
};

// Clear employee cache to force reload
export const clearEmployeeCache = (date) => {
  const cacheKey = `employees_${date}`;
  localStorage.removeItem(cacheKey);
  console.log(`🗑️ Cleared employee cache for ${date}`);
};