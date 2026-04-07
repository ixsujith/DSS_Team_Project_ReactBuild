import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  executeQuery,
  executeTempQuery,
  getAllDbTypes,
  getConfigsByDbType,
  getQueriesByDbType,
} from "../api/client";

function highlightMatch(text, term) {
  const source = String(text ?? "");
  const query = term.trim();
  if (!query) return source;

  const parts = [];
  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let start = 0;
  let matchIndex = lowerSource.indexOf(lowerQuery, start);

  while (matchIndex !== -1) {
    if (matchIndex > start) {
      parts.push(source.slice(start, matchIndex));
    }
    parts.push(
      <span key={`${source}-${matchIndex}`} className="highlight">
        {source.slice(matchIndex, matchIndex + query.length)}
      </span>,
    );
    start = matchIndex + query.length;
    matchIndex = lowerSource.indexOf(lowerQuery, start);
  }

  if (start < source.length) {
    parts.push(source.slice(start));
  }

  return parts;
}

function ResultTable({ columns, rows }) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${rowIndex}-${row.join("|")}`}>
            {row.map((cell, cellIndex) => (
              <td key={`${rowIndex}-${cellIndex}`}>
                {cell === "NULL" ? (
                  <span style={{ color: "#999", fontStyle: "italic" }}>NULL</span>
                ) : (
                  cell
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QueryExecutionPage() {
  const [dbTypes, setDbTypes] = useState([]);

  const [executionAlert, setExecutionAlert] = useState(null);
  const [selectedDbType, setSelectedDbType] = useState("");
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState("");

  const [allQueriesForType, setAllQueriesForType] = useState([]);
  const [querySearchTerm, setQuerySearchTerm] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [loadingQueries, setLoadingQueries] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [currentPageSize, setCurrentPageSize] = useState(50);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [resultCardVisible, setResultCardVisible] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [scratchAlert, setScratchAlert] = useState(null);
  const [scratchDbType, setScratchDbType] = useState("");
  const [scratchConnections, setScratchConnections] = useState([]);
  const [scratchConnectionsLoading, setScratchConnectionsLoading] = useState(false);
  const [scratchConfigId, setScratchConfigId] = useState("");
  const [scratchQueryText, setScratchQueryText] = useState("");
  const [scratchPageSize, setScratchPageSize] = useState(50);
  const [scratchPage, setScratchPage] = useState(0);
  const [scratchLoading, setScratchLoading] = useState(false);
  const [scratchResult, setScratchResult] = useState(null);
  const [scratchResultsVisible, setScratchResultsVisible] = useState(false);

  const querySearchWrapperRef = useRef(null);
  const resultsCardRef = useRef(null);

  const completedSteps = selectedQuery ? 3 : selectedConfigId ? 2 : selectedDbType ? 1 : 0;

  const filteredQueries = useMemo(() => {
    const term = querySearchTerm.trim().toLowerCase();
    if (!term) return allQueriesForType;

    return allQueriesForType.filter((query) => {
      const name = query.name?.toLowerCase() || "";
      const description = query.description?.toLowerCase() || "";
      return name.includes(term) || description.includes(term);
    });
  }, [allQueriesForType, querySearchTerm]);

  const resetMainResults = useCallback(() => {
    setResultCardVisible(false);
    setExecutionLoading(false);
    setExecutionResult(null);
    setCurrentPage(0);
  }, []);

  const resetSelectedQuery = useCallback(() => {
    setSelectedQuery(null);
    setQuerySearchTerm("");
    setShowSearchResults(false);
  }, []);

  const loadDbTypes = useCallback(async () => {
    try {
      const types = await getAllDbTypes();
      if (!Array.isArray(types) || types.length === 0) {
        setDbTypes([]);
        setExecutionAlert({
          message: "No DB configurations found. Please add one on the DB Config page.",
          type: "alert-info",
        });
        return;
      }

      setDbTypes(types);
    } catch {
      setExecutionAlert({
        message: "Failed to load DB types. Is the backend running?",
        type: "alert-error",
      });
    }
  }, []);

  useEffect(() => {
    loadDbTypes();
  }, [loadDbTypes]);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!querySearchWrapperRef.current?.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  const handleDbTypeChange = async (event) => {
    const dbType = event.target.value;
    setExecutionAlert(null);
    setSelectedDbType(dbType);
    setSelectedConfigId("");
    setConnections([]);
    setAllQueriesForType([]);
    resetSelectedQuery();
    resetMainResults();

    if (!dbType) return;

    setLoadingConnections(true);
    try {
      const configs = await getConfigsByDbType(dbType);
      if (!Array.isArray(configs) || configs.length === 0) {
        setExecutionAlert({
          message: `No connections found for "${dbType}". Add one on the DB Config page.`,
          type: "alert-info",
        });
        setConnections([]);
        return;
      }

      setConnections(configs);
    } catch {
      setExecutionAlert({
        message: "Failed to load connections. Please try again.",
        type: "alert-error",
      });
      setConnections([]);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleConnectionChange = async (event) => {
    const configId = event.target.value;
    setExecutionAlert(null);
    setSelectedConfigId(configId);
    setAllQueriesForType([]);
    resetSelectedQuery();
    resetMainResults();

    if (!configId || !selectedDbType) return;

    setLoadingQueries(true);
    try {
      const queries = await getQueriesByDbType(selectedDbType);
      const safeQueries = Array.isArray(queries) ? queries : [];
      setAllQueriesForType(safeQueries);

      if (safeQueries.length === 0) {
        setExecutionAlert({
          message: `No queries found for "${selectedDbType}". Go to Query Management to add one.`,
          type: "alert-info",
        });
      }
    } catch {
      setExecutionAlert({
        message: "Failed to load queries. Please try again.",
        type: "alert-error",
      });
    } finally {
      setLoadingQueries(false);
    }
  };

  const runExecution = useCallback(
    async (page, pageSize = currentPageSize) => {
      if (!selectedQuery || !selectedConfigId) return;

      setExecutionAlert(null);
      setResultCardVisible(true);
      setExecutionLoading(true);
      setExecutionResult(null);

      requestAnimationFrame(() => {
        resultsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      try {
        const result = await executeQuery({
          queryId: selectedQuery.queryId,
          configId: Number(selectedConfigId),
          page,
          pageSize,
        });

        if (result.error) {
          setExecutionAlert({ message: result.error, type: "alert-error" });
          setResultCardVisible(false);
          return;
        }

        setCurrentPage(result.page ?? page);
        setExecutionResult(result);
      } catch {
        setExecutionAlert({
          message: "Execution failed. Please try again.",
          type: "alert-error",
        });
        setResultCardVisible(false);
      } finally {
        setExecutionLoading(false);
      }
    },
    [currentPageSize, selectedConfigId, selectedQuery],
  );

  const handleExecute = () => {
    setCurrentPage(0);
    runExecution(0, currentPageSize);
  };

  const handlePageSizeChange = (event) => {
    const value = Number.parseInt(event.target.value, 10);
    setCurrentPageSize(value);
    setCurrentPage(0);
    if (selectedQuery && selectedConfigId) {
      runExecution(0, value);
    }
  };

  const handleResetMain = () => {
    setExecutionAlert(null);
    setSelectedDbType("");
    setConnections([]);
    setSelectedConfigId("");
    setAllQueriesForType([]);
    resetSelectedQuery();
    resetMainResults();
  };

  const runScratchQuery = useCallback(
    async (page, pageSize = scratchPageSize) => {
      const query = scratchQueryText.trim();
      if (!query) {
        setScratchAlert({ message: "Please enter a SQL query.", type: "alert-error" });
        return;
      }
      if (!scratchConfigId) {
        setScratchAlert({
          message: "Please select a connection.",
          type: "alert-error",
        });
        return;
      }

      setScratchAlert(null);
      setScratchResultsVisible(true);
      setScratchLoading(true);
      setScratchResult(null);

      try {
        const result = await executeTempQuery({
          configId: Number(scratchConfigId),
          queryText: query,
          page,
          pageSize,
        });

        if (result.error) {
          setScratchAlert({ message: result.error, type: "alert-error" });
          setScratchResultsVisible(false);
          return;
        }

        setScratchPage(result.page ?? page);
        setScratchResult(result);
      } catch {
        setScratchAlert({
          message: "Query failed. Check your SQL and try again.",
          type: "alert-error",
        });
        setScratchResultsVisible(false);
      } finally {
        setScratchLoading(false);
      }
    },
    [scratchConfigId, scratchPageSize, scratchQueryText],
  );

  const handleScratchDbTypeChange = async (event) => {
    const dbType = event.target.value;
    setScratchDbType(dbType);
    setScratchAlert(null);
    setScratchConnections([]);
    setScratchConfigId("");
    setScratchResultsVisible(false);
    setScratchResult(null);
    setScratchPage(0);

    if (!dbType) return;

    setScratchConnectionsLoading(true);
    try {
      const configs = await getConfigsByDbType(dbType);
      if (Array.isArray(configs)) {
        setScratchConnections(configs);
      }
    } catch {
      setScratchAlert({ message: "Failed to load connections.", type: "alert-error" });
      setScratchConnections([]);
    } finally {
      setScratchConnectionsLoading(false);
    }
  };

  const handleScratchClear = () => {
    setScratchAlert(null);
    setScratchDbType("");
    setScratchConnections([]);
    setScratchConfigId("");
    setScratchQueryText("");
    setScratchResultsVisible(false);
    setScratchResult(null);
    setScratchPage(0);
  };

  const searchPlaceholder = (() => {
    if (!selectedConfigId) return "Select a connection first...";
    if (loadingQueries) return "Loading queries...";
    if (allQueriesForType.length === 0) {
      return selectedDbType ? `No queries saved for ${selectedDbType}` : "No queries found";
    }
    return `Search ${allQueriesForType.length} saved queries...`;
  })();

  return (
    <div className="container query-execution-page">
      <h1 className="page-title">Query Execution</h1>

      <div className="card">
        <div
          className={`scratchpad-toggle ${scratchpadOpen ? "open" : ""}`}
          onClick={() => setScratchpadOpen((previous) => !previous)}
        >
          <span className="toggle-icon">▶</span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e3a5f" }}>
            Temp Query Scratchpad
          </span>
          <span style={{ fontSize: "12px", color: "#888", marginLeft: "4px" }}>
            test any query without saving
          </span>
        </div>

        <div className={`scratchpad-body ${scratchpadOpen ? "open" : ""}`}>
          {scratchAlert && (
            <div className={`alert ${scratchAlert.type} show`}>{scratchAlert.message}</div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="scratchDbType">Database Type</label>
              <select
                id="scratchDbType"
                value={scratchDbType}
                onChange={handleScratchDbTypeChange}
              >
                <option value="">-- Select DB Type --</option>
                {dbTypes.map((type) => (
                  <option key={`scratch-${type}`} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="scratchConnection">Connection</label>
              <select
                id="scratchConnection"
                value={scratchConfigId}
                onChange={(event) => {
                  setScratchConfigId(event.target.value);
                  setScratchResultsVisible(false);
                  setScratchResult(null);
                  setScratchPage(0);
                }}
                disabled={!scratchDbType || scratchConnectionsLoading}
              >
                {!scratchDbType ? (
                  <option value="">-- Select DB Type first --</option>
                ) : scratchConnectionsLoading ? (
                  <option value="">-- Loading... --</option>
                ) : (
                  <>
                    <option value="">-- Select Connection --</option>
                    {scratchConnections.map((config) => (
                      <option key={config.configId} value={config.configId}>
                        {config.dbName}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="scratchQuery">SQL Query</label>
            <textarea
              id="scratchQuery"
              rows={4}
              placeholder="e.g. SELECT * FROM employees WHERE department = 'Engineering'"
              value={scratchQueryText}
              onChange={(event) => setScratchQueryText(event.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              className="btn btn-success"
              onClick={() => {
                setScratchPage(0);
                runScratchQuery(0, scratchPageSize);
              }}
              disabled={!scratchConfigId}
            >
              Run Temp Query
            </button>

            <button className="btn btn-secondary" onClick={handleScratchClear}>
              Clear
            </button>

            <div
              className="form-group"
              style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}
            >
              <label style={{ margin: 0, whiteSpace: "nowrap" }}>Rows per page</label>
              <select
                value={scratchPageSize}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setScratchPageSize(value);
                  if (scratchResult && scratchConfigId && scratchQueryText.trim()) {
                    setScratchPage(0);
                    runScratchQuery(0, value);
                  }
                }}
                style={{ width: "80px", padding: "8px" }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {scratchResultsVisible && (
            <div style={{ marginTop: "20px" }}>
              {scratchResult && (
                <div style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>
                  <span>
                    <strong>Total Rows:</strong> {scratchResult.totalRows}
                  </span>
                  <span style={{ marginLeft: "24px" }}>
                    <strong>Page:</strong> {scratchResult.page + 1} of{" "}
                    {scratchResult.totalPages}
                  </span>
                </div>
              )}

              {scratchLoading && <div className="spinner show">Running query...</div>}

              {!scratchLoading &&
                scratchResult &&
                Array.isArray(scratchResult.rows) &&
                scratchResult.rows.length > 0 && (
                  <div className="table-wrapper">
                    <ResultTable columns={scratchResult.columns} rows={scratchResult.rows} />
                  </div>
                )}

              {!scratchLoading &&
                scratchResult &&
                Array.isArray(scratchResult.rows) &&
                scratchResult.rows.length === 0 && (
                  <div className="empty-state">Query returned no results.</div>
                )}

              {!scratchLoading &&
                scratchResult &&
                scratchResult.totalPages > 1 && (
                  <div className="pagination" style={{ justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        if (scratchPage > 0) {
                          runScratchQuery(scratchPage - 1, scratchPageSize);
                        }
                      }}
                      disabled={scratchPage === 0}
                    >
                      Prev
                    </button>
                    <span>
                      Page {scratchPage + 1} of {scratchResult.totalPages}
                    </span>
                    <button
                      onClick={() => {
                        if (scratchPage < scratchResult.totalPages - 1) {
                          runScratchQuery(scratchPage + 1, scratchPageSize);
                        }
                      }}
                      disabled={scratchPage >= scratchResult.totalPages - 1}
                    >
                      Next
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Select and Execute</h2>

        <div className="steps">
          <div className={`step ${completedSteps > 0 ? "done" : completedSteps === 0 ? "active" : ""}`}>
            <div className="step-circle">1</div>
            <div className="step-label">DB Type</div>
          </div>
          <div className={`step-line ${completedSteps >= 2 ? "done" : ""}`} />
          <div className={`step ${completedSteps > 1 ? "done" : completedSteps === 1 ? "active" : ""}`}>
            <div className="step-circle">2</div>
            <div className="step-label">Connection</div>
          </div>
          <div className={`step-line ${completedSteps >= 3 ? "done" : ""}`} />
          <div className={`step ${completedSteps === 2 ? "active" : completedSteps > 2 ? "done" : ""}`}>
            <div className="step-circle">3</div>
            <div className="step-label">Query</div>
          </div>
        </div>

        {executionAlert && (
          <div className={`alert ${executionAlert.type} show`}>{executionAlert.message}</div>
        )}

        <div className="form-group">
          <label htmlFor="dbTypeSelect">Step 1 — Select Database Type</label>
          <select id="dbTypeSelect" value={selectedDbType} onChange={handleDbTypeChange}>
            <option value="">-- Select DB Type --</option>
            {dbTypes.map((type) => (
              <option key={`exec-${type}`} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="connectionSelect">Step 2 — Select Connection</label>
          <select
            id="connectionSelect"
            value={selectedConfigId}
            onChange={handleConnectionChange}
            disabled={!selectedDbType || loadingConnections}
          >
            {!selectedDbType ? (
              <option value="">-- Select a DB Type first --</option>
            ) : loadingConnections ? (
              <option value="">-- Loading connections... --</option>
            ) : connections.length === 0 ? (
              <option value="">-- No connections available --</option>
            ) : (
              <>
                <option value="">-- Select Connection --</option>
                {connections.map((config) => (
                  <option key={config.configId} value={config.configId}>
                    {config.dbName}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Step 3 — Search and Select Query</label>
          <div className="search-wrapper" ref={querySearchWrapperRef}>
            <span className="search-icon">?</span>
            <input
              type="text"
              value={querySearchTerm}
              onChange={(event) => {
                setQuerySearchTerm(event.target.value);
                if (!showSearchResults) {
                  setShowSearchResults(true);
                }
              }}
              onFocus={() => {
                if (allQueriesForType.length > 0) {
                  setShowSearchResults(true);
                }
              }}
              placeholder={searchPlaceholder}
              disabled={!selectedConfigId || allQueriesForType.length === 0}
              autoComplete="off"
            />
            <div className={`search-results ${showSearchResults ? "open" : ""}`}>
              {filteredQueries.length === 0 ? (
                <div className="search-no-results">
                  No queries match "{querySearchTerm.trim()}"
                </div>
              ) : (
                filteredQueries.map((query) => (
                  <div
                    key={query.queryId}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedQuery(query);
                      setQuerySearchTerm("");
                      setShowSearchResults(false);
                    }}
                  >
                    <div className="query-name">
                      {highlightMatch(query.name, querySearchTerm)}
                    </div>
                    {query.description && (
                      <div className="query-desc">{query.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`selected-query-badge ${selectedQuery ? "show" : ""}`}>
            <span>Selected query:</span>
            <span className="badge-name">{selectedQuery?.name}</span>
            <button
              className="badge-clear"
              title="Clear selection"
              onClick={() => {
                resetSelectedQuery();
                resetMainResults();
              }}
            >
              x
            </button>
          </div>
        </div>

        {selectedQuery && (
          <div>
            <div className="form-group">
              <label>Query Preview</label>
              <div
                style={{
                  background: "#f0f2f5",
                  border: "1px solid #d1d9e0",
                  borderRadius: "6px",
                  padding: "12px 16px",
                  fontFamily: '"Courier New", monospace',
                  fontSize: "13px",
                  color: "#1e3a5f",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {selectedQuery.queryText}
              </div>
            </div>

            {selectedQuery.description && (
              <div
                style={{
                  fontSize: "13px",
                  color: "#666",
                  marginBottom: "16px",
                  fontStyle: "italic",
                }}
              >
                {selectedQuery.description}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div
            className="form-group"
            style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}
          >
            <label style={{ margin: 0, whiteSpace: "nowrap" }}>Rows per page</label>
            <select
              value={currentPageSize}
              onChange={handlePageSizeChange}
              style={{ width: "80px", padding: "8px" }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <button
            className="btn btn-success"
            onClick={handleExecute}
            disabled={!selectedQuery || !selectedConfigId}
          >
            Execute Query
          </button>

          <button className="btn btn-secondary" onClick={handleResetMain}>
            Reset
          </button>
        </div>
      </div>

      {resultCardVisible && (
        <div ref={resultsCardRef} className="card">
          <h2 className="card-title">Query Results</h2>

          {executionResult && (
            <div
              style={{
                fontSize: "13px",
                color: "#555",
                marginBottom: "16px",
                display: "flex",
                gap: "24px",
                flexWrap: "wrap",
              }}
            >
              <span>
                <strong>Total Rows:</strong> {executionResult.totalRows}
              </span>
              <span>
                <strong>Page:</strong> {executionResult.page + 1} of{" "}
                {executionResult.totalPages}
              </span>
              <span>
                <strong>Columns:</strong> {executionResult.columns.length}
              </span>
            </div>
          )}

          {executionLoading && <div className="spinner show">Executing query...</div>}

          {!executionLoading &&
            executionResult &&
            Array.isArray(executionResult.rows) &&
            executionResult.rows.length > 0 && (
              <div className="table-wrapper">
                <ResultTable
                  columns={executionResult.columns}
                  rows={executionResult.rows}
                />
              </div>
            )}

          {!executionLoading &&
            executionResult &&
            Array.isArray(executionResult.rows) &&
            executionResult.rows.length === 0 && (
              <div className="empty-state">Query returned no results.</div>
            )}

          {!executionLoading &&
            executionResult &&
            executionResult.totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => {
                    if (currentPage > 0) {
                      runExecution(currentPage - 1, currentPageSize);
                    }
                  }}
                  disabled={currentPage === 0}
                >
                  Prev
                </button>
                <span>
                  Page {currentPage + 1} of {executionResult.totalPages}
                </span>
                <button
                  onClick={() => {
                    if (currentPage < executionResult.totalPages - 1) {
                      runExecution(currentPage + 1, currentPageSize);
                    }
                  }}
                  disabled={currentPage >= executionResult.totalPages - 1}
                >
                  Next
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export default QueryExecutionPage;
