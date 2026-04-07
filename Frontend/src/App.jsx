import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import DbConfigPage from "./pages/DbConfigPage";
import QueryManagementPage from "./pages/QueryManagementPage";
import QueryExecutionPage from "./pages/QueryExecutionPage";
import AuditLogsPage from "./pages/AuditLogsPage";

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<DbConfigPage />} />
        <Route path="/queries" element={<QueryManagementPage />} />
        <Route path="/execute" element={<QueryExecutionPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
