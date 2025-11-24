// import Header from "../Components/Header"
// import DropDownList from "../Components/DropDownList"
// import "../index.css"
// import { useState, useEffect, useRef } from "react"
// import ShiftsDropDownList from "../Components/ShiftDropDownList"
// import { employeesApi } from "../services/employeesAPI"
// import { planningApi } from "../services/planningAPI"

// export default function Planning() {
//     const [isOpen, setIsOpen] = useState(false);
//     const [employees, setEmployees] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [saving, setSaving] = useState(false);
//     const [loadingPlanning, setLoadingPlanning] = useState(false);
//     const [activeTab, setActiveTab] = useState(0); // 0-6 for days of week
//     const [assignments, setAssignments] = useState({}); //NEWWWWWWWWWWWWWWWWWWWWWW
    
//     // add near your useState declarations
//     const [copiedDay, setCopiedDay] = useState(null);
//     const [tick, setTick] = useState(0); // used to force a re-render

//     // Refs to store the current planning data for each day
//     const planningDataRefs = useRef({});
//     const existingPlannings = useRef({});

//     // Define posts (tasks)
//     const posts = [
//         { id: 1, name: "Pizzaiolo" },
//         { id: 2, name: "Livreur" },
//         { id: 3, name: "Agent polyvalent" },
//         { id: 4, name: "Prepateur" },
//         { id: 5, name: "Cassier" },
//         { id: 6, name: "Serveur" },
//         { id: 7, name: "Plongeur" },
//         { id: 8, name: "Manageur" },
//         { id: 9, name: "Packaging" },
//         { id: 10, name: "Topping" },
//         { id: 11, name: "Bar" }
//     ];

//     // Define shifts
//     const shifts = [
//         { id: 1, name: "6:00-14:00 (1)", time: "6:00-14:00" },
//         { id: 2, name: "8:00-16:00 (2)", time: "8:00-16:00" },
//         { id: 3, name: "16:00-00:00 (3)", time: "16:00-00:00" }
//     ];

//     // Get dates for the current week (Monday to Sunday)
//     const getWeekDates = () => {
//         const dates = [];
//         const today = new Date();
//         const currentDay = today.getDay();
//         const monday = new Date(today);
//         monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1)); // Adjust to get Monday

//         for (let i = 0; i < 7; i++) {
//             const date = new Date(monday);
//             date.setDate(monday.getDate() + i);
//             dates.push(date.toISOString().split('T')[0]);
//         }
//         return dates;
//     };

//     const [weekDates, setWeekDates] = useState(getWeekDates());

//     // Day names for tabs
//     const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

//     // Get current date for the active tab
//     const getCurrentDate = () => weekDates[activeTab];

//     // Format date for display
//     const formatDateDisplay = (dateString) => {
//         const date = new Date(dateString);
//         return date.toLocaleDateString('en-US', {
//             weekday: 'long',
//             month: 'short',
//             day: 'numeric'
//         });
//     };


//     // Fetch employees from API on component mount
//     useEffect(() => {
//         const fetchEmployees = async () => {
//             try {
//                 setLoading(true);
//                 const employeesData = await planningApi.getEmployees();


//                 const transformedEmployees = employeesData.map(emp => ({
//                     name: emp.name,
//                     emp_id: emp.emp_id || emp.id
//                 }));

//                 setEmployees(transformedEmployees);
//                 //fetchAllPlannedShifts(transformedEmployees);
//             } catch (err) {
//                 // console.error('Error fetching employees:', err);
//                 // setError('Failed to load employees');
//                 // setEmployees(getFallbackEmployees());
//                 console.error("❌ Error fetching employees:", err);
//                 setEmployees([]); // No fake fallback
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchEmployees();
//     }, []);

//     // Load planning when tab changes
//     useEffect(() => {
//         if (employees.length > 0) {
//             loadExistingPlanningForTab(activeTab);
//         }
//     }, [activeTab, employees]);

    
//   const loadExistingPlanningForTab = async (tabIndex) => {
//   const date = weekDates[tabIndex];
//   try {
//     setLoadingPlanning(true);
//     const planningData = await planningApi.getPlanning(date);
//     console.log('API returned:', planningData);
    
//     existingPlannings.current[date] = planningData;

//     if (!planningDataRefs.current[date]) {
//       planningDataRefs.current[date] = {};
//     }

//     planningData.forEach((assignment) => {
//       const key = `${assignment.task_id}-${assignment.shift_id}`;

//       // Ensure an array exists for this key
//       if (!Array.isArray(planningDataRefs.current[date][key])) {
//         planningDataRefs.current[date][key] = [];
//       }

//       // Avoid duplicates
//       const alreadyExists = planningDataRefs.current[date][key].some(
//         (emp) => emp.emp_id === assignment.emp_id
//       );

//       if (!alreadyExists) {
//         planningDataRefs.current[date][key].push({
//           emp_id: assignment.emp_id,
//           employee_name: assignment.employee_name,
//           task_id: assignment.task_id,
//           shift_id: assignment.shift_id,
//           plan_date: date,
//         });
//       }
//     });

//     console.log(`✅ Loaded planning for ${date}:`, planningDataRefs.current[date]);
//   } catch (error) {
//     console.error(`❌ Error loading planning for ${date}:`, error);
//     existingPlannings.current[date] = [];
//     if (!planningDataRefs.current[date]) {
//       planningDataRefs.current[date] = {};
//     }
//   } finally {
//     setLoadingPlanning(false);
//   }
// };

//     // Function to get fallback employees
//     const getFallbackEmployees = () => [
//         { name: "Akram Dib", emp_id: 1 },
//         { name: "Alaa krem", emp_id: 2 },
//         // ... include all your fallback employees with emp_id
//     ];

    
//     // Function to handle employee selection in a dropdown
//     const handleEmployeeSelect = (postId, shiftId, employee, date) => {
//         const key = `${postId}-${shiftId}`;
//         if (!planningDataRefs.current[date]) {
//             planningDataRefs.current[date] = {};
//         }

//         //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
//         // Initialize the array for this specific post + shift
//         if (!Array.isArray(planningDataRefs.current[date][key])) {
//             planningDataRefs.current[date][key] = [];
//         }

//         // Get the current assigned employees
//         const currentEmployees = planningDataRefs.current[date][key];

//         // Avoid adding the same employee twice
//         const alreadyExists = currentEmployees.some(e => e.emp_id === employee.emp_id);
        
        
//         // Add employee if not already assigned
//         if (!alreadyExists) {
//             currentEmployees.push({
//                 shift_id: shiftId,
//                 emp_id: employee.emp_id,
//                 task_id: postId,
//                 plan_date: date,
//                 employee_name: employee.name
//             });
//         }

//         // Optional: Log the result
//         console.log(`✅ Added employee ${employee?.name} to post ${postId}, shift ${shiftId}, date ${date}`);
//         //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW

//     };

//     const getSelectedEmployee = (postId, shiftId, date) => {
//     if (!planningDataRefs.current[date]) return [];

//     const key = `${postId}-${shiftId}`;
//     const entry = planningDataRefs.current[date][key];

//     if (!entry) return [];

//     // Case 1: multiple employees stored as array
//     if (Array.isArray(entry)) {
//         return entry.map(e => ({
//         emp_id: e.emp_id,
//         name: e.employee_name || employees.find(emp => emp.emp_id === e.emp_id)?.name || "Unknown"
//         }));
//     }

//     // Case 2: single employee stored as object
//     if (entry.emp_id) {
//         return [{
//         emp_id: entry.emp_id,
//         name: entry.employee_name || employees.find(emp => emp.emp_id === entry.emp_id)?.name || "Unknown"
//         }];
//     }

//     return [];
//     };

//     const savePlanning = async () => {
//         const currentDate = getCurrentDate(); // this is your selected day
//         console.log("🧩 Saving planning for:", currentDate);

//         try {
//             setSaving(true);

//             //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
//             // ✅ Make sure the latest data for that day exists
//             const dayData = planningDataRefs.current?.[currentDate] || {};
//             const planningArray = [];

//             // Loop over each key (e.g., "1-0", "2-1", etc.)
//             Object.entries(dayData).forEach(([key, employees]) => {
//                 if (!employees) return;

//                 // Extract postId and shiftId from the key
//                 const [postId, shiftId] = key.split('-');

//                 if (Array.isArray(employees)) {
//                     // ✅ Multiple employees assigned to the same post/shift
//                     employees.forEach(emp => {
//                         if (emp?.emp_id) {
//                             planningArray.push({
//                                 shift_id: parseInt(shiftId),
//                                 emp_id: emp.emp_id,
//                                 task_id: parseInt(postId),
//                                 plan_date: currentDate,
//                             });
//                         }
//                     });
//                 } else if (employees.emp_id) {
//                     // ✅ Single employee assigned
//                     planningArray.push({
//                         shift_id: parseInt(shiftId),
//                         emp_id: employees.emp_id,
//                         task_id: parseInt(postId),
//                         plan_date: currentDate,
//                     });
//                 }
//             });
//             //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW

//         //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
//         // ✅ No data to save
//         if (planningArray.length === 0) {
//             alert('No planning data to save!');
//             return;
//         }

//         console.log("📦 planningArray before save:", planningArray);

//         // ✅ Send data to backend
//         await planningApi.savePlanning({
//             plan_date: currentDate,
//             assignments: planningArray
//         });

//         alert(`Planning for ${formatDateDisplay(currentDate)} saved successfully!`);

//         // ✅ Reload the planning table to reflect changes
//         await loadExistingPlanningForTab(activeTab);

//         } catch (error) {
//             console.error('❌ Error saving planning:', error);
//             alert('Error saving planning: ' + error.message);
//         } finally {
//             setSaving(false);
//         }
//         //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
//     };

//     //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
//     const saveAllPlanning = async () => { 
//      try {
//         setSaving(true);
//         let totalSaved = 0;

//         for (const date of weekDates) {
//             const planningArray = [];

//             // ✅ Check if we have planning data for this date
//             if (planningDataRefs.current?.[date]) {
//                 Object.entries(planningDataRefs.current[date]).forEach(([key, item]) => {
//                     if (!item) return;

//                     // 🔹 Multiple employees assigned to the same shift
//                     if (Array.isArray(item)) {
//                         item.forEach(emp => {
//                             if (emp?.emp_id) {
//                                 planningArray.push({
//                                     shift_id: emp.shift_id,
//                                     emp_id: emp.emp_id,
//                                     task_id: emp.task_id,
//                                     plan_date: date
//                                 });
//                             }
//                         });
//                     } 
//                     // 🔹 Single employee assigned
//                     else if (item.emp_id) {
//                         planningArray.push({
//                             shift_id: item.shift_id,
//                             emp_id: item.emp_id,
//                             task_id: item.task_id,
//                             plan_date: date
//                         });
//                     }
//                 });
//             }

//             // ✅ If there’s data to save for this day
//             if (planningArray.length > 0) {
//                 console.log(`📦 Saving planning for ${date}:`, planningArray);

//                 await planningApi.savePlanning({
//                     plan_date: date,
//                     assignments: planningArray
//                 });

//                 totalSaved += planningArray.length;
//             }
//         }

//         alert(`✅ All planning saved successfully! Total assignments: ${totalSaved}`);
//         } catch (error) {
//             console.error('❌ Error saving all planning:', error);
//             alert('Error saving planning: ' + error.message);
//         } finally {
//             setSaving(false);
//         }
//     };
//     //NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW


//     // ================== COPY & PASTE DAY (debuggable) ==================
//     const copyDay = () => {
//         const date = getCurrentDate();
//         console.log('copyDay clicked — date:', date);

//         const dayPlanning = planningDataRefs.current[date];
//         console.log(planningDataRefs.current[date]);
//         console.log('copyDay - dayPlanning (from ref):', dayPlanning);

//         if (!dayPlanning || Object.keys(dayPlanning).length === 0) {
//             alert("No planning to copy for this date!");
//             return;
//         }

//         // Only copy slots that have an assigned emp_id (non-empty)
//         const filteredEntries = Object.entries(dayPlanning).filter(
//         ([k, v]) => Array.isArray(v) && v.some(emp => emp.emp_id)
//         );

//         const filtered = Object.fromEntries(filteredEntries);


//         console.log('copyDay - filtered (only assigned):', filtered);

//         if (Object.keys(filtered).length === 0) {
//             alert("No affected employees to copy!");
//             return;
//         }

//         setCopiedDay(JSON.parse(JSON.stringify(filtered))); // deep copy
//         console.log('copyDay - copiedDay state set to:', JSON.parse(JSON.stringify(filtered)));
//         alert(`Planning for ${formatDateDisplay(date)} copied successfully!`);
//     };

//     const pasteDay = () => {
//         const date = getCurrentDate();

//         if (!copiedDay) {
//             alert("No day copied yet!");
//             return;
//         }

//         // ✅ Ensure the day exists in memory
//         if (!planningDataRefs.current[date]) planningDataRefs.current[date] = {};

//         // ✅ Copy all slots from copied day to selected day
//         planningDataRefs.current[date] = JSON.parse(JSON.stringify(copiedDay));

//         // ✅ Refresh the screen
//         setTick(t => t + 1);

//         alert(`✅ Copied planning pasted to ${formatDateDisplay(date)}!`);
//     };



//     // Navigate to previous/next week
//     const navigateWeek = (direction) => {
//         const newWeekDates = weekDates.map(date => {
//             const d = new Date(date);
//             d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
//             return d.toISOString().split('T')[0];
//         });
//         setWeekDates(newWeekDates);
//     };

//     if (loading) {
//         return (
//             <>
//                 <Header />
//                 <div style={{
//                     display: "flex",
//                     justifyContent: "center",
//                     alignItems: "center",
//                     height: "50vh"
//                 }}>
//                     <div>Loading employees...</div>
//                 </div>
//             </>
//         );
//     }


//     const exportWeekPlanning = () => {
//         if (!employees || employees.length === 0) {
//             alert("No planning data to export!");
//             return;
//         }

//         let csvContent = '';

//         weekDates.forEach(date => {
//             // Add date as a title row
//             csvContent += `Date: ${date}\n`;

//             // Add header for this day
//             const header = ['Post'];
//             shifts.forEach(shift => {
//                 header.push(shift.time);
//             });
//             csvContent += header.join(',') + '\n';

//             // Add rows for each post
//             posts.forEach(post => {
//                 const row = [post.name];
//                 shifts.forEach(shift => {
//                     const dayData = planningDataRefs.current[date] || {};
//                     const key = `${post.id}-${shift.id}`;
//                     const assignment = dayData[key];
//                     row.push(assignment?.employee_name || '');
//                 });
//                 csvContent += row.join(',') + '\n';
//             });

//             // Add an empty line to separate days
//             csvContent += '\n';
//         });

//         // Download CSV
//         const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
//         const url = URL.createObjectURL(blob);

//         const link = document.createElement('a');
//         link.href = url;
//         link.setAttribute('download', `weekly_planning_${new Date().toISOString().split('T')[0]}.csv`);
//         document.body.appendChild(link);
//         link.click();
//         document.body.removeChild(link);

//         alert("✅ Weekly planning exported successfully!");
//     };




//     return (
//         <>
//             <Header />
//             <div
//                 style={{
//                     display: "flex",
//                     justifyContent: "flex-start",
//                     alignItems: "center",
//                     color: "black",
//                     fontSize: "30px",
//                     marginLeft: "35px",
//                     marginTop: "40px",
//                     marginBottom: "0px",
//                 }}
//             >
//                 Weekly Planning Table
//             </div>
//             <div
//                 style={{
//                     display: "flex",
//                     justifyContent: "flex-start",
//                     alignItems: "center",
//                     color: "black",
//                     fontSize: "14px",
//                     marginLeft: "35px",
//                     marginTop: "5px",
//                     marginBottom: "20px",
//                 }}
//             >
//                 Organize and display work shifts for the entire week
//             </div>

//             {/* Week Navigation */}
//             <div style={{ margin: "0 35px 20px", display: "flex", alignItems: "center", gap: "15px" }}>
//                 <button
//                     className="cntbtn"
//                     onClick={() => navigateWeek('prev')}
//                     style={{ padding: "8px 16px", width: "200px" }}

//                 >
//                     ← Previous Week
//                 </button>
//                 <span style={{ fontWeight: "bold", fontSize: "16px" }}>
//                     Week of {formatDateDisplay(weekDates[0])} - {formatDateDisplay(weekDates[6])}
//                 </span>
//                 <button
//                     className="cntbtn"
//                     onClick={() => navigateWeek('next')}
//                     style={{ padding: "8px 3px", width: "200px" }}
//                 >
//                     Next Week →
//                 </button>
//             </div>

//             {/* Day Tabs */}
//             <div style={{ margin: "0 35px 20px" }}>
//                 <div className="tabs-container">
//                     {dayNames.map((day, index) => (
//                         <button
//                             key={index}
//                             className={`tab-button ${activeTab === index ? 'active' : ''}`}
//                             onClick={() => setActiveTab(index)}
//                         >
//                             <div>{day}</div>
//                             <div style={{ fontSize: "12px", opacity: 0.8 }}>
//                                 {new Date(weekDates[index]).getDate()}
//                             </div>
//                         </button>
//                     ))}
//                 </div>
//             </div>

//             {/* Copy / Paste day buttons */}
//             <div style={{ margin: "20px 35px", display: "flex", gap: "10px" }}>
//                 <button className="cntbtn" onClick={copyDay}>Copy Day</button>
//                 <button className="cntbtn" onClick={pasteDay}>Paste Day</button>
//             </div>
//             {/* Current Tab Info */}
//             <div style={{ margin: "0 35px 20px", display: "flex", alignItems: "center", gap: "15px" }}>
//                 <span style={{ fontWeight: "bold" }}>
//                     {formatDateDisplay(getCurrentDate())}
//                 </span>
//                 {loadingPlanning && <span>Loading planning...</span>}
//                 {!loadingPlanning && (
//                     <span style={{ color: 'green', fontSize: '14px' }}>
//                         Found {existingPlannings.current[getCurrentDate()]?.length || 0} assignments
//                     </span>
//                 )}
//             </div>


//             {/* Planning Table for Active Tab */}
//             <div>
//                 <table border="1" cellPadding="20" cellSpacing="0" style={{ width: "95%", margin: "0 auto" }}>
//                     <thead>
//                         <tr>
//                             <th>Posts/Shifts</th>
//                             {shifts.map(shift => (
//                                 <th key={shift.id}>{shift.name}</th>
//                             ))}
//                             <th>Operations</th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {posts.map(post => (
//                             <tr key={post.id}>
//                                 <td style={{ background: "linear-gradient(to right, #EB4219, #F6892A)", color: "white" }}>
//                                     {post.name}
//                                 </td>
//                                 {shifts.map(shift => (
//                                     <td key={shift.id}>
//                                         {/* NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWw */} 
//                                         {/* Display already selected employees */}
//                                         {(getSelectedEmployee(post.id, shift.id, getCurrentDate()) || []).map((emp, idx) => ( 
//                                            <div key={idx}>{emp.name}</div>
//                                         ))}

//                                         <DropDownList 
//                                             employees={employees.filter(e =>
//                                                 // Hide employees already selected for this post + shift + date
//                                                 !getSelectedEmployee(post.id, shift.id, getCurrentDate()).some(sel => sel.emp_id === e.emp_id)
//                                             )}
//                                             onSelect={(employee) =>
//                                                 handleEmployeeSelect(post.id, shift.id, employee, getCurrentDate())
//                                             }
//                                             // ❌ No selectedEmployee prop — handled elsewhere in multi-employee view
//                                         />
//                                         {/* NEWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWw */}
//                                     </td>
//                                 ))}
//                                 <td>
//                                     <button className="edit-btn" onClick={() => setIsOpen(true)}>Edit</button>
//                                 </td>
//                             </tr>
//                         ))}
//                     </tbody>
//                 </table>

//                 {/* Modal/Dialog */}
//                 {isOpen && (
//                     <div className="dialog-backdrop">
//                         <div className="dialog-box">
//                             <h3
//                                 style={{
//                                     textAlign: "center",
//                                     marginTop: "0",
//                                     background: "linear-gradient(to right, #EB4219, #F6892A, #F36224, #EB4219)",
//                                     WebkitBackgroundClip: "text",
//                                     WebkitTextFillColor: "transparent"
//                                 }}
//                             >
//                                 Message
//                             </h3>

//                             <p style={{ textAlign: "center", fontSize: "16px", marginTop: "20px" }}>
//                                 Employee is added successfully to the cell.  
//                             </p>

//                             <div style={{ textAlign: "center", marginTop: "30px" }}>
//                                 <button className="edit-btn" onClick={() => setIsOpen(false)}>
//                                     Close
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 {/* Action Buttons */}

//                 <button
//                     onClick={exportWeekPlanning}
//                     style={{
//                         margin: '10px 0',
//                         padding: '8px 12px',
//                         backgroundColor: '#28a745',
//                         color: 'white',
//                         border: 'none',
//                         borderRadius: '4px',
//                         cursor: 'pointer'
//                     }}
//                 >
//                     Export Weekly Planning
//                 </button>

//                 <div className='cntbtns' style={{ marginTop: "30px" }}>
//                   <button 
//                     className='cntbtn' 
//                     onClick={savePlanning}
//                     disabled={saving || loadingPlanning}
//                   >
//                     {saving ? 'Saving...' : `Save ${dayNames[activeTab]} Planning`}
//                   </button>
//                   {/* <button 
//                     className='cntbtn' 
//                     onClick={saveAllPlanning}
//                     disabled={saving}
//                     style={{backgroundColor: '#28a745'}}
//                   >
//                     {saving ? 'Saving...' : 'Save Entire Week'}
//                   </button>
//                   <button 
//                     className='cntbtn' 
//                     onClick={() => loadExistingPlanningForTab(activeTab)}
//                     disabled={loadingPlanning}
//                     style={{backgroundColor: '#17a2b8'}}
//                   >
//                     {loadingPlanning ? 'Loading...' : 'Refresh'}
//                   </button> */}
//                 </div>
//             </div>

//             {/* Add CSS for tabs */}
//             <style jsx>{`
//                 .tabs-container {
//                     display: flex;
//                     border-bottom: 2px solid #e0e0e0;
//                 }
//                 .tab-button {
//                     flex: 1;
//                     padding: 15px 10px;
//                     border: none;
//                     background: #f8f9fa;
//                     cursor: pointer;
//                     transition: all 0.3s ease;
//                     border-bottom: 3px solid transparent;
//                     text-align: center;
//                 }
//                 .tab-button:hover {
//                     background: #e9ecef;
//                 }
//                 .tab-button.active {
//                     background: white;
//                     border-bottom: 3px solid #EB4219;
//                     font-weight: bold;
//                     color: #EB4219;
//                 }
//             `}</style>
//         </>
//     )
// }

import Header from "../Components/Header"
import DropDownList from "../Components/DropDownList"
import "../index.css"
import { useState, useEffect, useRef } from "react"
import ShiftsDropDownList from "../Components/ShiftDropDownList"
import { employeesApi } from "../services/employeesAPI"
import { planningApi } from "../services/planningAPI"

export default function Planning() {
    const [isOpen, setIsOpen] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loadingPlanning, setLoadingPlanning] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [assignments, setAssignments] = useState({});
    
    const [copiedDay, setCopiedDay] = useState(null);
    const [tick, setTick] = useState(0);

    const planningDataRefs = useRef({});
    const existingPlannings = useRef({});

    const posts = [
        { id: 1, name: "Pizzaiolo" },
        { id: 2, name: "Livreur" },
        { id: 3, name: "Agent polyvalent" },
        { id: 4, name: "Prepateur" },
        { id: 5, name: "Cassier" },
        { id: 6, name: "Serveur" },
        { id: 7, name: "Plongeur" },
        { id: 8, name: "Manageur" },
        { id: 9, name: "Packaging" },
        { id: 10, name: "Topping" },
        { id: 11, name: "Bar" }
    ];

    const shifts = [
        { id: 1, name: "6:00-14:00 (1)", time: "6:00-14:00" },
        { id: 2, name: "8:00-16:00 (2)", time: "8:00-16:00" },
        { id: 3, name: "16:00-00:00 (3)", time: "16:00-00:00" }
    ];

    const getWeekDates = () => {
        const dates = [];
        const today = new Date();
        const currentDay = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1));

        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    };

    const [weekDates, setWeekDates] = useState(getWeekDates());
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const getCurrentDate = () => weekDates[activeTab];

    const formatDateDisplay = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    };

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                setLoading(true);
                const employeesData = await planningApi.getEmployees();

                const transformedEmployees = employeesData.map(emp => ({
                    name: emp.name,
                    emp_id: emp.emp_id || emp.id
                }));

                setEmployees(transformedEmployees);
            } catch (err) {
                console.error("❌ Error fetching employees:", err);
                setEmployees([]);
            } finally {
                setLoading(false);
            }
        };

        fetchEmployees();
    }, []);

    useEffect(() => {
        if (employees.length > 0) {
            loadExistingPlanningForTab(activeTab);
        }
    }, [activeTab, employees]);

    const loadExistingPlanningForTab = async (tabIndex) => {
        const date = weekDates[tabIndex];
        try {
            setLoadingPlanning(true);
            const planningData = await planningApi.getPlanning(date);
            existingPlannings.current[date] = planningData;

            if (!planningDataRefs.current[date]) {
                planningDataRefs.current[date] = {};
            }

            planningData.forEach((assignment) => {
                const key = `${assignment.task_id}-${assignment.shift_id}`;

                if (!Array.isArray(planningDataRefs.current[date][key])) {
                    planningDataRefs.current[date][key] = [];
                }

                const alreadyExists = planningDataRefs.current[date][key].some(
                    (emp) => emp.emp_id === assignment.emp_id
                );

                if (!alreadyExists) {
                    planningDataRefs.current[date][key].push({
                        emp_id: assignment.emp_id,
                        employee_name: assignment.employee_name,
                        task_id: assignment.task_id,
                        shift_id: assignment.shift_id,
                        plan_date: date,
                    });
                }
            });

        } catch (error) {
            console.error(`❌ Error loading planning for ${date}:`, error);
            existingPlannings.current[date] = [];
            if (!planningDataRefs.current[date]) {
                planningDataRefs.current[date] = {};
            }
        } finally {
            setLoadingPlanning(false);
        }
    };

    const getFallbackEmployees = () => [
        { name: "Akram Dib", emp_id: 1 },
        { name: "Alaa krem", emp_id: 2 },
    ];

    const handleEmployeeSelect = (postId, shiftId, employee, date) => {
        const key = `${postId}-${shiftId}`;
        if (!planningDataRefs.current[date]) {
            planningDataRefs.current[date] = {};
        }

        if (!Array.isArray(planningDataRefs.current[date][key])) {
            planningDataRefs.current[date][key] = [];
        }

        const currentEmployees = planningDataRefs.current[date][key];

        const alreadyExists = currentEmployees.some(e => e.emp_id === employee.emp_id);

        if (!alreadyExists) {
            currentEmployees.push({
                shift_id: shiftId,
                emp_id: employee.emp_id,
                task_id: postId,
                plan_date: date,
                employee_name: employee.name
            });
        }
    };

    const getSelectedEmployee = (postId, shiftId, date) => {
        if (!planningDataRefs.current[date]) return [];

        const key = `${postId}-${shiftId}`;
        const entry = planningDataRefs.current[date][key];

        if (!entry) return [];

        if (Array.isArray(entry)) {
            return entry.map(e => ({
                emp_id: e.emp_id,
                name: e.employee_name || employees.find(emp => emp.emp_id === e.emp_id)?.name || "Unknown"
            }));
        }

        if (entry.emp_id) {
            return [{
                emp_id: entry.emp_id,
                name: entry.employee_name || employees.find(emp => emp.emp_id === entry.emp_id)?.name || "Unknown"
            }];
        }

        return [];
    };

    const savePlanning = async () => {
        const currentDate = getCurrentDate();

        try {
            setSaving(true);

            const dayData = planningDataRefs.current?.[currentDate] || {};
            const planningArray = [];

            Object.entries(dayData).forEach(([key, employees]) => {
                if (!employees) return;

                const [postId, shiftId] = key.split('-');

                if (Array.isArray(employees)) {
                    employees.forEach(emp => {
                        if (emp?.emp_id) {
                            planningArray.push({
                                shift_id: parseInt(shiftId),
                                emp_id: emp.emp_id,
                                task_id: parseInt(postId),
                                plan_date: currentDate,
                            });
                        }
                    });
                } else if (employees.emp_id) {
                    planningArray.push({
                        shift_id: parseInt(shiftId),
                        emp_id: employees.emp_id,
                        task_id: parseInt(postId),
                        plan_date: currentDate,
                    });
                }
            });

            if (planningArray.length === 0) {
                alert('No planning data to save!');
                return;
            }

            await planningApi.savePlanning({
                plan_date: currentDate,
                assignments: planningArray
            });

            alert(`Planning for ${formatDateDisplay(currentDate)} saved successfully!`);

            await loadExistingPlanningForTab(activeTab);

        } catch (error) {
            console.error('❌ Error saving planning:', error);
            alert('Error saving planning: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const saveAllPlanning = async () => {
        try {
            setSaving(true);
            let totalSaved = 0;

            for (const date of weekDates) {
                const planningArray = [];

                if (planningDataRefs.current?.[date]) {
                    Object.entries(planningDataRefs.current[date]).forEach(([key, item]) => {
                        if (!item) return;

                        if (Array.isArray(item)) {
                            item.forEach(emp => {
                                if (emp?.emp_id) {
                                    planningArray.push({
                                        shift_id: emp.shift_id,
                                        emp_id: emp.emp_id,
                                        task_id: emp.task_id,
                                        plan_date: date
                                    });
                                }
                            });
                        } else if (item.emp_id) {
                            planningArray.push({
                                shift_id: item.shift_id,
                                emp_id: item.emp_id,
                                task_id: item.task_id,
                                plan_date: date
                            });
                        }
                    });
                }

                if (planningArray.length > 0) {
                    await planningApi.savePlanning({
                        plan_date: date,
                        assignments: planningArray
                    });

                    totalSaved += planningArray.length;
                }
            }

            alert(`✅ All planning saved successfully! Total assignments: ${totalSaved}`);

        } catch (error) {
            console.error('❌ Error saving all planning:', error);
            alert('Error saving planning: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const copyDay = () => {
        const date = getCurrentDate();

        const dayPlanning = planningDataRefs.current[date];

        if (!dayPlanning || Object.keys(dayPlanning).length === 0) {
            alert("No planning to copy for this date!");
            return;
        }

        const filteredEntries = Object.entries(dayPlanning).filter(
            ([k, v]) => Array.isArray(v) && v.some(emp => emp.emp_id)
        );

        const filtered = Object.fromEntries(filteredEntries);

        if (Object.keys(filtered).length === 0) {
            alert("No affected employees to copy!");
            return;
        }

        setCopiedDay(JSON.parse(JSON.stringify(filtered)));
        alert(`Planning for ${formatDateDisplay(date)} copied successfully!`);
    };

    const pasteDay = () => {
        const date = getCurrentDate();

        if (!copiedDay) {
            alert("No day copied yet!");
            return;
        }

        if (!planningDataRefs.current[date]) planningDataRefs.current[date] = {};

        planningDataRefs.current[date] = JSON.parse(JSON.stringify(copiedDay));

        setTick(t => t + 1);

        alert(`✅ Copied planning pasted to ${formatDateDisplay(date)}!`);
    };

    const navigateWeek = (direction) => {
        const newWeekDates = weekDates.map(date => {
            const d = new Date(date);
            d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
            return d.toISOString().split('T')[0];
        });
        setWeekDates(newWeekDates);
    };

    if (loading) {
        return (
            <>
                <Header />
                <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "50vh"
                }}>
                    <div>Loading employees...</div>
                </div>
            </>
        );
    }

    const exportWeekPlanning = () => {
        if (!employees || employees.length === 0) {
            alert("No planning data to export!");
            return;
        }

        let csvContent = '';

        weekDates.forEach(date => {
            csvContent += `Date: ${date}\n`;

            const header = ['Post'];
            shifts.forEach(shift => {
                header.push(shift.time);
            });
            csvContent += header.join(',') + '\n';

            posts.forEach(post => {
                const row = [post.name];
                shifts.forEach(shift => {
                    const dayData = planningDataRefs.current[date] || {};
                    const key = `${post.id}-${shift.id}`;
                    const assignment = dayData[key];
                    row.push(assignment?.employee_name || '');
                });
                csvContent += row.join(',') + '\n';
            });

            csvContent += '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `weekly_planning_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("✅ Weekly planning exported successfully!");
    };


       // 🔥 NEW — remove employee from a cell
        const handleRemoveEmployee = (postId, shiftId, emp_id, date) => {
            const key = `${postId}-${shiftId}`;

            if (!planningDataRefs.current[date]) return;
            if (!planningDataRefs.current[date][key]) return;

            const confirmDelete = window.confirm(
                "Are you sure you want to remove this employee?"
            );
            if (!confirmDelete) return;

            // Remove employee
            planningDataRefs.current[date][key] =
                planningDataRefs.current[date][key].filter(emp => emp.emp_id !== emp_id);

            // Force UI refresh
            setTick(t => t + 1);
        };


    return (
        <>
            <Header />
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    color: "black",
                    fontSize: "30px",
                    marginLeft: "35px",
                    marginTop: "40px",
                    marginBottom: "0px",
                }}
            >
                Weekly Planning Table
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    color: "black",
                    fontSize: "14px",
                    marginLeft: "35px",
                    marginTop: "5px",
                    marginBottom: "20px",
                }}
            >
                Organize and display work shifts for the entire week
            </div>

            <div style={{ margin: "0 35px 20px", display: "flex", alignItems: "center", gap: "15px" }}>
                <button
                    className="cntbtn"
                    onClick={() => navigateWeek('prev')}
                    style={{ padding: "8px 16px", width: "200px" }}

                >
                    ← Previous Week
                </button>
                <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                    Week of {formatDateDisplay(weekDates[0])} - {formatDateDisplay(weekDates[6])}
                </span>
                <button
                    className="cntbtn"
                    onClick={() => navigateWeek('next')}
                    style={{ padding: "8px 3px", width: "200px" }}
                >
                    Next Week →
                </button>
            </div>

            <div style={{ margin: "0 35px 20px" }}>
                <div className="tabs-container">
                    {dayNames.map((day, index) => (
                        <button
                            key={index}
                            className={`tab-button ${activeTab === index ? 'active' : ''}`}
                            onClick={() => setActiveTab(index)}
                        >
                            <div>{day}</div>
                            <div style={{ fontSize: "12px", opacity: 0.8 }}>
                                {new Date(weekDates[index]).getDate()}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ margin: "20px 35px", display: "flex", gap: "10px" }}>
                <button className="cntbtn" onClick={copyDay}>Copy Day</button>
                <button className="cntbtn" onClick={pasteDay}>Paste Day</button>
            </div>

            <div style={{ margin: "0 35px 20px", display: "flex", alignItems: "center", gap: "15px" }}>
                <span style={{ fontWeight: "bold" }}>
                    {formatDateDisplay(getCurrentDate())}
                </span>
                {loadingPlanning && <span>Loading planning...</span>}
                {!loadingPlanning && (
                    <span style={{ color: 'green', fontSize: '14px' }}>
                        Found {existingPlannings.current[getCurrentDate()]?.length || 0} assignments
                    </span>
                )}
            </div>

            <div>
                <table border="1" cellPadding="20" cellSpacing="0" style={{ width: "95%", margin: "0 auto" }}>
                    <thead>
                        <tr>
                            <th>Posts/Shifts</th>
                            {shifts.map(shift => (
                                <th key={shift.id}>{shift.name}</th>
                            ))}
                            <th>Operations</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map(post => (
                            <tr key={post.id}>
                                <td style={{ background: "linear-gradient(to right, #EB4219, #F6892A)", color: "white" }}>
                                    {post.name}
                                </td>
                                {shifts.map(shift => (
                                    <td key={shift.id}>

                                        {/* {(getSelectedEmployee(post.id, shift.id, getCurrentDate()) || []).map((emp, idx) => (
                                            <div key={idx}>{emp.name}</div>
                                        ))} */
                                        (getSelectedEmployee(post.id, shift.id, getCurrentDate()) || []).map((emp, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    cursor: "pointer",
                                                    color: "#EB4219",
                                                    fontWeight: "bold",
                                                    padding: "2px 0"
                                                }}
                                                onClick={() =>
                                                    handleRemoveEmployee(
                                                        post.id,
                                                        shift.id,
                                                        emp.emp_id,
                                                        getCurrentDate()
                                                    )
                                                }
                                            >
                                                {emp.name}
                                            </div>
                                        ))    
                                        }
                                        
                                        <DropDownList
                                            employees={employees.filter(e =>
                                                !getSelectedEmployee(post.id, shift.id, getCurrentDate()).some(sel => sel.emp_id === e.emp_id)
                                            )}
                                            onSelect={(employee) =>
                                                handleEmployeeSelect(post.id, shift.id, employee, getCurrentDate())
                                            }
                                        />
                                    </td>
                                ))}
                                <td>
                                    <button className="edit-btn" onClick={() => setIsOpen(true)}>Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {isOpen && (
                    <div className="dialog-backdrop">
                        <div className="dialog-box">
                            <h3
                                style={{
                                    textAlign: "center",
                                    marginTop: "0",
                                    background: "linear-gradient(to right, #EB4219, #F6892A, #F36224, #EB4219)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent"
                                }}
                            >
                                Message
                            </h3>

                            <p style={{ textAlign: "center", fontSize: "16px", marginTop: "20px" }}>
                                Employee is added successfully to the cell.  
                            </p>

                            <div style={{ textAlign: "center", marginTop: "30px" }}>
                                <button className="edit-btn" onClick={() => setIsOpen(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    onClick={exportWeekPlanning}
                    style={{
                        margin: '10px 0',
                        padding: '8px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Export Weekly Planning
                </button>

                <div className='cntbtns' style={{ marginTop: "30px" }}>
                    <button
                        className='cntbtn'
                        onClick={savePlanning}
                        disabled={saving || loadingPlanning}
                    >
                        {saving ? 'Saving...' : `Save ${dayNames[activeTab]} Planning`}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .tabs-container {
                    display: flex;
                    border-bottom: 2px solid #e0e0e0;
                }
                .tab-button {
                    flex: 1;
                    padding: 15px 10px;
                    border: none;
                    background: #f8f9fa;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-bottom: 3px solid transparent;
                    text-align: center;
                }
                .tab-button:hover {
                    background: #e9ecef;
                }
                .tab-button.active {
                    background: white;
                    border-bottom: 3px solid #EB4219;
                    font-weight: bold;
                    color: #EB4219;
                }
            `}</style>
        </>
    )
}
