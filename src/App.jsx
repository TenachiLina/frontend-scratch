// import './App.css'
// import ClockInOut from "./Pages/Clock-inPage"
// import Planning from "./Pages/PlanningPage"
// import Reporting from "./Pages/Reporting"
// import Home from "./Pages/Home"

// function App() {
//   return(
//     <>
//        {/* <ClockInOut /> */}
//        <Planning />   
//        {/* <Reporting /> */}
//        {/* <Home />  */}
//     </>   
//   )
// }

// export default App

import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import './App.css';
import ClockInOut from "./Pages/Clock-inPage";
import ClockInOutUser from "./Pages/Clock-inPageUser";

import Planning from "./Pages/PlanningPage";
import Reporting from "./Pages/Reporting";
import Home from "./Pages/Home";
//CRUDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
import Emp_Management from "./Pages/Emp_Management";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clock-in" element={<ClockInOut />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/reporting" element={<Reporting />} />
        <Route path="/emp-management" element={<Emp_Management />} /> 
        <Route path="/ClockInOutUser" element={<ClockInOutUser />} /> 
      </Routes>
    </Router>
  );
}

export default App;
