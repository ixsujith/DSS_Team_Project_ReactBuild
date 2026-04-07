import { useCallback, useEffect, useMemo, useState } from "react";
import {
  executeQuery,
  executeTempQuery,
  getAllDbConfigs,
  getAllDbTypes,
  getAllQueries,
  getConfigsByDbType,
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
  const [executionAlert, setExecutionAlert] = useState(null);
  const [allQueries, setAllQueries] = useState([]);
  const [allConfigs, setAllConfigs] = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuery, setSelectedQuery] = useState(null);

  const [currentPage, setCurrentPage] = useState(0);
  const [currentPageSize, setCurrentPageSize] = useState(50);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [resultCardVisible, setResultCardVisible] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  const [dbTypes, setDbTypes] = useState([]);
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

  const configNameById = useMemo(() => {
    const map = new Map();
    allConfigs.forEach((config) => {
      map.set(String(config.configId), config.dbName);
    });
    return map;
  }, [allConfigs]);

  const filteredQueries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allQueries;

    return allQueries.filter((query) => {
      const name = query.name?.toLowerCase() || "";
      const description = query.description?.toLowerCase() || "";
      const dbType = query.dbType?.toLowerCase() || "";
      const connectionName = (
        configNameById.get(String(query.configId)) || ""
      ).toLowerCase();

      return (
        name.includes(term) ||
        description.includes(term) ||
        dbType.includes(term) ||
        connectionName.includes(term)
      );
    });
  }, [allQueries, configNameById, searchTerm]);

  const loadExecutionData = useCallback(async () => {
    setQueriesLoading(true);
    setExecutionAlert(null);
    try {
      const [queries, configs] = await Promise.all([getAllQueries(), getAllDbConfigs()]);
      setAllQueries(Array.isArray(queries) ? queries : []);
      setAllConfigs(Array.isArray(configs) ? configs : []);
    } catch {
      setExecutionAlert({
        message: "Failed to load saved queries.",
        type: "alert-error",
      });
      setAllQueries([]);
      setAllConfigs([]);
    } finally {
      setQueriesLoading(false);
    }
  }, []);

  const loadDbTypes = useCallback(async () => {
    try {
      const types = await getAllDbTypes();
      setDbTypes(Array.isArray(types) ? types : []);
    } catch {
      setDbTypes([]);
    }
  }, []);

  useEffect(() => {
    loadExecutionData();
    loadDbTypes();
  }, [loadDbTypes, loadExecutionData]);

  const runExecutionById = useCallback(
    async (queryId, page, pageSize = currentPageSize) => {
      setExecutionAlert(null);
      setResultCardVisible(true);
      setExecutionLoading(true);
      setExecutionResult(null);

      try {
        const result = await executeQuery({
          queryId,
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
    [currentPageSize],
  );

  const handleRunQuery = (query) => {
    setSelectedQuery(query);
    setCurrentPage(0);
    runExecutionById(query.queryId, 0, currentPageSize);
  };

  const handlePageSizeChange = (event) => {
    const value = Number.parseInt(event.target.value, 10);
    setCurrentPageSize(value);
    setCurrentPage(0);
    if (selectedQuery) {
      runExecutionById(selectedQuery.queryId, 0, value);
    }
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
      setScratchConnections(Array.isArray(configs) ? configs : []);
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
        <h2 className="card-title">Saved Queries</h2>

        {executionAlert && (
          <div className={`alert ${executionAlert.type} show`}>{executionAlert.message}</div>
        )}

        <div className="form-group" style={{ marginBottom: "12px" }}>
          <label htmlFor="querySearch">Search</label>
          <input
            id="querySearch"
            type="text"
            placeholder="Search by query name, description, db type, or connection..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="search-count" style={{ marginBottom: "14px" }}>
          {filteredQueries.length === allQueries.length
            ? `${allQueries.length} saved queries`
            : `Showing ${filteredQueries.length} of ${allQueries.length} saved queries`}
        </div>

        {queriesLoading && <div className="spinner show">Loading saved queries...</div>}

        {!queriesLoading && filteredQueries.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Connection</th>
                  <th>DB Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueries.map((query, index) => (
                  <tr
                    key={query.queryId}
                    style={{
                      backgroundColor:
                        selectedQuery?.queryId === query.queryId ? "#f0f6ff" : undefined,
                    }}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <strong>{highlightMatch(query.name, searchTerm)}</strong>
                    </td>
                    <td>
                      {query.description ? (
                        highlightMatch(query.description, searchTerm)
                      ) : (
                        <span style={{ color: "#999" }}>—</span>
                      )}
                    </td>
                    <td>{configNameById.get(String(query.configId)) || `#${query.configId}`}</td>
                    <td>
                      <span className="badge badge-info">{query.dbType}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-success"
                        style={{ padding: "6px 14px", fontSize: "12px" }}
                        onClick={() => handleRunQuery(query)}
                      >
                        Run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!queriesLoading && filteredQueries.length === 0 && (
          <div className="empty-state">
            {searchTerm.trim()
              ? `No saved query matches "${searchTerm.trim()}".`
              : "No saved queries found."}
          </div>
        )}
      </div>

      {selectedQuery && (
        <div className="card">
          <h2 className="card-title">Selected Query</h2>
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
        </div>
      )}

      {resultCardVisible && (
        <div className="card">
          <h2 className="card-title">Query Results</h2>

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
          </div>

          {executionResult && (
            <div
              style={{
                fontSize: "13px",
                color: "#555",
                marginBottom: "16px",
                marginTop: "14px",
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
                <ResultTable columns={executionResult.columns} rows={executionResult.rows} />
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
                    if (currentPage > 0 && selectedQuery) {
                      runExecutionById(selectedQuery.queryId, currentPage - 1, currentPageSize);
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
                    if (
                      selectedQuery &&
                      currentPage < executionResult.totalPages - 1
                    ) {
                      runExecutionById(selectedQuery.queryId, currentPage + 1, currentPageSize);
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
