import { useCallback, useEffect, useMemo, useState } from "react";
import { executeQuery, getAllQueries } from "./api/client";
import Sidebar from "./components/Sidebar";
import AuditLogsPanel from "./components/panels/AuditLogsPanel";
import DbConfigPanel from "./components/panels/DbConfigPanel";
import QueryResultPanel from "./components/panels/QueryResultPanel";
import ReportConfigPanel from "./components/panels/ReportConfigPanel";

function App() {
  const [activeView, setActiveView] = useState("execution");
  const [allQueries, setAllQueries] = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQueryId, setSelectedQueryId] = useState(null);

  const [executionAlert, setExecutionAlert] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionPage, setExecutionPage] = useState(0);
  const [executionPageSize, setExecutionPageSize] = useState(25);

  const loadQueries = useCallback(async () => {
    setQueriesLoading(true);
    try {
      const queries = await getAllQueries();
      setAllQueries(Array.isArray(queries) ? queries : []);
    } catch {
      setAllQueries([]);
      setExecutionAlert({
        message: "Failed to load saved queries. Is the backend running?",
        type: "alert-error",
      });
    } finally {
      setQueriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  const filteredQueries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allQueries;

    return allQueries.filter((query) => {
      const name = query.name?.toLowerCase() || "";
      const description = query.description?.toLowerCase() || "";
      const dbType = query.dbType?.toLowerCase() || "";
      const queryText = query.queryText?.toLowerCase() || "";

      return (
        name.includes(term) ||
        description.includes(term) ||
        dbType.includes(term) ||
        queryText.includes(term)
      );
    });
  }, [allQueries, searchTerm]);

  useEffect(() => {
    if (filteredQueries.length === 0) {
      setSelectedQueryId(null);
      return;
    }

    if (!filteredQueries.some((query) => query.queryId === selectedQueryId)) {
      setSelectedQueryId(filteredQueries[0].queryId);
    }
  }, [filteredQueries, selectedQueryId]);

  const selectedQuery = useMemo(
    () => allQueries.find((query) => query.queryId === selectedQueryId) || null,
    [allQueries, selectedQueryId],
  );

  const runQueryById = useCallback(
    async (queryId, page = 0, pageSize = executionPageSize) => {
      setActiveView("execution");
      setExecutionAlert(null);
      setExecutionResult(null);
      setExecutionLoading(true);

      try {
        const result = await executeQuery({
          queryId,
          page,
          pageSize,
        });

        if (result.error) {
          setExecutionAlert({ message: result.error, type: "alert-error" });
          return;
        }

        setExecutionPage(result.page ?? page);
        setExecutionPageSize(pageSize);
        setExecutionResult(result);
      } catch {
        setExecutionAlert({
          message: "Execution failed. Please try again.",
          type: "alert-error",
        });
      } finally {
        setExecutionLoading(false);
      }
    },
    [executionPageSize],
  );

  const handleRunQuery = useCallback(
    (queryId = null) => {
      const targetQueryId = queryId || selectedQueryId || filteredQueries[0]?.queryId;

      if (!targetQueryId) {
        setActiveView("execution");
        setExecutionResult(null);
        setExecutionAlert({
          message: "No saved queries found. Add one from Report Config.",
          type: "alert-info",
        });
        return;
      }

      setSelectedQueryId(targetQueryId);
      setExecutionPage(0);
      runQueryById(targetQueryId, 0, executionPageSize);
    },
    [executionPageSize, filteredQueries, runQueryById, selectedQueryId],
  );

  const handleExecutionPageChange = useCallback(
    (nextPage) => {
      if (!selectedQueryId) return;
      runQueryById(selectedQueryId, nextPage, executionPageSize);
    },
    [executionPageSize, runQueryById, selectedQueryId],
  );

  const handleExecutionPageSizeChange = useCallback(
    (nextPageSize) => {
      setExecutionPageSize(nextPageSize);
      setExecutionPage(0);

      if (!selectedQueryId) return;
      runQueryById(selectedQueryId, 0, nextPageSize);
    },
    [runQueryById, selectedQueryId],
  );

  return (
    <div className="workspace-shell">
      <Sidebar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filteredQueries={filteredQueries}
        queriesLoading={queriesLoading}
        selectedQueryId={selectedQueryId}
        onRunQuery={handleRunQuery}
        activeView={activeView}
        onShowDbConfig={() => setActiveView("db-config")}
        onShowReportConfig={() => setActiveView("report-config")}
        onShowAuditLogs={() => setActiveView("audit-logs")}
      />

      <main className="workspace-main">
        {activeView === "db-config" && <DbConfigPanel />}

        {activeView === "report-config" && (
          <ReportConfigPanel onQueriesChanged={loadQueries} />
        )}

        {activeView === "execution" && (
          <QueryResultPanel
            selectedQuery={selectedQuery}
            executionAlert={executionAlert}
            executionLoading={executionLoading}
            executionResult={executionResult}
            currentPage={executionPage}
            pageSize={executionPageSize}
            onPageChange={handleExecutionPageChange}
            onPageSizeChange={handleExecutionPageSizeChange}
          />
        )}

        {activeView === "audit-logs" && <AuditLogsPanel />}
      </main>
    </div>
  );
}

export default App;
