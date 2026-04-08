import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeQuery, getAllDbConfigs, getAllQueries } from "./api/client";
import Sidebar from "./components/Sidebar";
import AuditLogsPanel from "./components/panels/AuditLogsPanel";
import DbConfigPanel from "./components/panels/DbConfigPanel";
import QueryResultPanel from "./components/panels/QueryResultPanel";
import ReportConfigPanel from "./components/panels/ReportConfigPanel";

const EXECUTION_STATE_KEY = "dss-execution-state";
const VALID_VIEWS = new Set(["execution", "db-config", "report-config", "audit-logs"]);
const VALID_PAGE_SIZES = new Set([10, 25, 50, 100]);
const SELECT_QUERY_MESSAGE = "Please select a query from the left sidebar to run.";
const DB_CONFIG_REQUIRED_MESSAGE =
  "Please complete DB Configuration before running a query.";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseSelectedQueryId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function readStoredExecutionState() {
  try {
    const rawState = sessionStorage.getItem(EXECUTION_STATE_KEY);
    if (!rawState) return null;

    const parsedState = JSON.parse(rawState);
    if (!parsedState || typeof parsedState !== "object") return null;

    const activeView = VALID_VIEWS.has(parsedState.activeView)
      ? parsedState.activeView
      : "execution";
    const selectedQueryId = parseSelectedQueryId(parsedState.selectedQueryId);
    const executionPage = parsePositiveInt(parsedState.executionPage, 0);

    const parsedPageSize = parsePositiveInt(parsedState.executionPageSize, 25);
    const executionPageSize = VALID_PAGE_SIZES.has(parsedPageSize) ? parsedPageSize : 25;

    return {
      activeView,
      selectedQueryId,
      executionPage,
      executionPageSize,
    };
  } catch {
    return null;
  }
}

function App() {
  const initialExecutionState = useMemo(() => readStoredExecutionState(), []);
  const initialExecutionStateRef = useRef(initialExecutionState);
  const hasRestoredExecutionRef = useRef(false);

  const [activeView, setActiveView] = useState(initialExecutionState?.activeView ?? "execution");
  const [allQueries, setAllQueries] = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(true);
  const [dbConfigsLoading, setDbConfigsLoading] = useState(true);
  const [hasDbConfigurations, setHasDbConfigurations] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQueryId, setSelectedQueryId] = useState(
    initialExecutionState?.selectedQueryId ?? null,
  );

  const [executionAlert, setExecutionAlert] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionPage, setExecutionPage] = useState(initialExecutionState?.executionPage ?? 0);
  const [executionPageSize, setExecutionPageSize] = useState(
    initialExecutionState?.executionPageSize ?? 25,
  );

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

  const loadDbConfigs = useCallback(async () => {
    setDbConfigsLoading(true);
    try {
      const configs = await getAllDbConfigs();
      setHasDbConfigurations(Array.isArray(configs) && configs.length > 0);
    } catch {
      setHasDbConfigurations(false);
    } finally {
      setDbConfigsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDbConfigs();
  }, [loadDbConfigs]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        EXECUTION_STATE_KEY,
        JSON.stringify({
          activeView,
          selectedQueryId,
          executionPage,
          executionPageSize,
        }),
      );
    } catch {
      // Ignore storage errors and keep the app usable.
    }
  }, [activeView, executionPage, executionPageSize, selectedQueryId]);

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
    if (queriesLoading) return;

    if (filteredQueries.length === 0) {
      setSelectedQueryId(null);
      return;
    }

    if (selectedQueryId && !filteredQueries.some((query) => query.queryId === selectedQueryId)) {
      setSelectedQueryId(null);
    }
  }, [filteredQueries, queriesLoading, selectedQueryId]);

  const selectedQuery = useMemo(
    () => allQueries.find((query) => query.queryId === selectedQueryId) || null,
    [allQueries, selectedQueryId],
  );

  const executionEmptyStateMessage = useMemo(() => {
    if (dbConfigsLoading) return "Checking database configurations...";
    if (!hasDbConfigurations) return DB_CONFIG_REQUIRED_MESSAGE;
    if (allQueries.length === 0) return "No saved queries found. Add one from Report Config.";
    return SELECT_QUERY_MESSAGE;
  }, [allQueries.length, dbConfigsLoading, hasDbConfigurations]);

  const runQueryById = useCallback(
    async (queryId, page = 0, pageSize = executionPageSize) => {
      setActiveView("execution");
      setExecutionAlert(null);
      setExecutionResult(null);

      if (dbConfigsLoading) {
        setExecutionAlert({
          message: "Checking database configurations. Please try again.",
          type: "alert-info",
        });
        return;
      }

      if (!hasDbConfigurations) {
        setExecutionAlert({
          message: DB_CONFIG_REQUIRED_MESSAGE,
          type: "alert-info",
        });
        return;
      }

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
    [dbConfigsLoading, executionPageSize, hasDbConfigurations],
  );

  useEffect(() => {
    if (queriesLoading || dbConfigsLoading || hasRestoredExecutionRef.current) return;
    hasRestoredExecutionRef.current = true;

    const persistedState = initialExecutionStateRef.current;
    if (!persistedState) return;
    if (persistedState.activeView !== "execution") return;
    if (!persistedState.selectedQueryId) return;
    if (!hasDbConfigurations) return;

    const hasPersistedQuery = allQueries.some(
      (query) => query.queryId === persistedState.selectedQueryId,
    );
    if (!hasPersistedQuery) return;

    setSelectedQueryId(persistedState.selectedQueryId);
    runQueryById(
      persistedState.selectedQueryId,
      persistedState.executionPage,
      persistedState.executionPageSize,
    );
  }, [allQueries, dbConfigsLoading, hasDbConfigurations, queriesLoading, runQueryById]);

  const handleRunQuery = useCallback(
    (queryId = null) => {
      setActiveView("execution");

      if (dbConfigsLoading) {
        setExecutionResult(null);
        setExecutionAlert({
          message: "Checking database configurations. Please try again.",
          type: "alert-info",
        });
        return;
      }

      if (!hasDbConfigurations) {
        setExecutionResult(null);
        setExecutionAlert({
          message: DB_CONFIG_REQUIRED_MESSAGE,
          type: "alert-info",
        });
        return;
      }

      const targetQueryId = queryId || selectedQueryId;
      if (!targetQueryId) {
        setExecutionResult(null);
        setExecutionAlert({
          message:
            allQueries.length === 0
              ? "No saved queries found. Add one from Report Config."
              : SELECT_QUERY_MESSAGE,
          type: "alert-info",
        });
        return;
      }

      setSelectedQueryId(targetQueryId);
      setExecutionPage(0);
      runQueryById(targetQueryId, 0, executionPageSize);
    },
    [
      allQueries.length,
      dbConfigsLoading,
      executionPageSize,
      hasDbConfigurations,
      runQueryById,
      selectedQueryId,
    ],
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
        {activeView === "db-config" && <DbConfigPanel onConfigsChanged={loadDbConfigs} />}

        {activeView === "report-config" && (
          <ReportConfigPanel onQueriesChanged={loadQueries} />
        )}

        {activeView === "execution" && (
          <QueryResultPanel
            selectedQuery={selectedQuery}
            executionAlert={executionAlert}
            executionLoading={executionLoading}
            executionResult={executionResult}
            emptyStateMessage={executionEmptyStateMessage}
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
