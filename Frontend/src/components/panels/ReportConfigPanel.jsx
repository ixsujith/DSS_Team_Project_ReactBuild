import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteQuery,
  executeTempQuery,
  getAllDbConfigs,
  getAllDbTypes,
  getAllQueries,
  saveQuery,
} from "../../api/client";

const initialForm = {
  name: "",
  dbType: "",
  configId: "",
  description: "",
  queryText: "",
};

function ReportConfigPanel({ onQueriesChanged }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [queries, setQueries] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [dbTypes, setDbTypes] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [formAlert, setFormAlert] = useState(null);
  const [tableAlert, setTableAlert] = useState(null);

  const [tableLoading, setTableLoading] = useState(true);
  const [savingQuery, setSavingQuery] = useState(false);

  const [testRunVisible, setTestRunVisible] = useState(false);
  const [testRunAlert, setTestRunAlert] = useState(null);
  const [testRunLoading, setTestRunLoading] = useState(false);
  const [testRunResult, setTestRunResult] = useState(null);
  const [testRunPage, setTestRunPage] = useState(0);

  const loadReportData = useCallback(async () => {
    setTableLoading(true);
    setTableAlert(null);

    try {
      const [queriesResult, configsResult, dbTypesResult] = await Promise.all([
        getAllQueries(),
        getAllDbConfigs(),
        getAllDbTypes(),
      ]);

      setQueries(Array.isArray(queriesResult) ? queriesResult : []);
      setConfigs(Array.isArray(configsResult) ? configsResult : []);
      setDbTypes(Array.isArray(dbTypesResult) ? dbTypesResult : []);
    } catch {
      setQueries([]);
      setConfigs([]);
      setDbTypes([]);
      setTableAlert({
        message: "Failed to load saved queries.",
        type: "alert-error",
      });
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const configNameById = useMemo(() => {
    const map = new Map();
    configs.forEach((config) => {
      map.set(String(config.configId), config.dbName);
    });
    return map;
  }, [configs]);

  const availableDbTypes = useMemo(() => {
    if (dbTypes.length > 0) return dbTypes;
    return [...new Set(configs.map((config) => config.dbType).filter(Boolean))];
  }, [configs, dbTypes]);

  const formConnections = useMemo(() => {
    if (!form.dbType) return [];
    return configs.filter(
      (config) => (config.dbType || "").toUpperCase() === form.dbType.toUpperCase(),
    );
  }, [configs, form.dbType]);

  const canRunTest = Boolean(form.configId && form.queryText.trim());

  const resetTestRun = useCallback(() => {
    setTestRunVisible(false);
    setTestRunAlert(null);
    setTestRunLoading(false);
    setTestRunResult(null);
    setTestRunPage(0);
  }, []);

  const refreshSidebarQueries = useCallback(async () => {
    if (!onQueriesChanged) return;
    await onQueriesChanged();
  }, [onQueriesChanged]);

  const runTestQuery = useCallback(
    async (page) => {
      const queryText = form.queryText.trim();
      const configId = Number.parseInt(form.configId, 10);

      if (!queryText) {
        setTestRunVisible(true);
        setTestRunAlert({
          message: "Please enter a SQL query first.",
          type: "alert-error",
        });
        return;
      }

      if (!configId) {
        setTestRunVisible(true);
        setTestRunAlert({
          message: "Please select a connection.",
          type: "alert-error",
        });
        return;
      }

      setTestRunVisible(true);
      setTestRunAlert(null);
      setTestRunLoading(true);
      setTestRunResult(null);

      try {
        const result = await executeTempQuery({
          configId,
          queryText,
          page,
          pageSize: 10,
        });

        if (result.error) {
          setTestRunAlert({ message: result.error, type: "alert-error" });
          return;
        }

        setTestRunPage(result.page ?? page);
        setTestRunResult(result);
      } catch {
        setTestRunAlert({
          message: "Test run failed. Check your query and connection.",
          type: "alert-error",
        });
      } finally {
        setTestRunLoading(false);
      }
    },
    [form.configId, form.queryText],
  );

  const handleSaveQuery = async () => {
    setFormAlert(null);

    const payload = {
      name: form.name.trim(),
      configId: Number.parseInt(form.configId, 10),
      description: form.description.trim(),
      queryText: form.queryText.trim(),
    };

    if (!payload.name) {
      setFormAlert({ message: "Query name is required.", type: "alert-error" });
      return;
    }
    if (!form.dbType) {
      setFormAlert({
        message: "Please select a database type.",
        type: "alert-error",
      });
      return;
    }
    if (!payload.description) {
      setFormAlert({ message: "Description is required.", type: "alert-error" });
      return;
    }
    if (!payload.configId || Number.isNaN(payload.configId)) {
      setFormAlert({
        message: "Please select a connection.",
        type: "alert-error",
      });
      return;
    }
    if (!payload.queryText) {
      setFormAlert({ message: "SQL query cannot be empty.", type: "alert-error" });
      return;
    }

    setSavingQuery(true);
    try {
      const result = await saveQuery(payload);

      if (result.queryId) {
        setFormAlert({
          message: `Query "${result.name}" saved successfully.`,
          type: "alert-success",
        });
        resetTestRun();
        setForm(initialForm);
        setShowAddForm(false);
        await loadReportData();
        await refreshSidebarQueries();
        return;
      }

      setFormAlert({
        message: result.error || "Failed to save query.",
        type: "alert-error",
      });
    } catch {
      setFormAlert({
        message: "Something went wrong. Please try again.",
        type: "alert-error",
      });
    } finally {
      setSavingQuery(false);
    }
  };

  const handleDelete = async (queryId) => {
    const confirmed = window.confirm("Are you sure you want to delete this query?");
    if (!confirmed) return;

    try {
      const response = await deleteQuery(queryId);
      if (response.ok || response.status === 204) {
        setTableAlert({
          message: "Query deleted successfully.",
          type: "alert-success",
        });
        await loadReportData();
        await refreshSidebarQueries();
        return;
      }

      let message = "Failed to delete query.";
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        message = "Failed to delete query.";
      }

      setTableAlert({ message, type: "alert-error" });
    } catch {
      setTableAlert({
        message: "Something went wrong while deleting the query.",
        type: "alert-error",
      });
    }
  };

  return (
    <section>
      <div className="workspace-panel-header">
        <h1 className="workspace-panel-title">Report Configuration</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            resetTestRun();
            setShowAddForm((previous) => !previous);
            setFormAlert(null);
          }}
        >
          {showAddForm ? "Close" : "Add Query"}
        </button>
      </div>

      {showAddForm && (
        <div className="card workspace-panel-card">
          <h2 className="card-title">Create New Query</h2>

          {formAlert && <div className={`alert ${formAlert.type} show`}>{formAlert.message}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="report-query-name">Query Name</label>
              <input
                id="report-query-name"
                type="text"
                placeholder="e.g. Active Customers"
                value={form.name}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, name: event.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="report-query-db-type">Database Type</label>
              <select
                id="report-query-db-type"
                value={form.dbType}
                onChange={(event) => {
                  const value = event.target.value;
                  resetTestRun();
                  setForm((previous) => ({ ...previous, dbType: value, configId: "" }));
                }}
              >
                <option value="">-- Select DB Type --</option>
                {availableDbTypes.map((type) => (
                  <option key={`report-dbtype-${type}`} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="report-query-config">Connection</label>
            <select
              id="report-query-config"
              value={form.configId}
              onChange={(event) => {
                resetTestRun();
                setForm((previous) => ({ ...previous, configId: event.target.value }));
              }}
              disabled={!form.dbType}
            >
              {!form.dbType ? (
                <option value="">-- Select DB Type first --</option>
              ) : (
                <>
                  <option value="">-- Select Connection --</option>
                  {formConnections.map((config) => (
                    <option key={`report-config-${config.configId}`} value={config.configId}>
                      {config.dbName}
                    </option>
                  ))}
                </>
              )}
            </select>
            {form.dbType && formConnections.length === 0 && (
              <div className="workspace-inline-hint">
                No connections found for the selected database type.
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="report-query-description">Description</label>
            <input
              id="report-query-description"
              type="text"
              placeholder="e.g. Lists all active customers"
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, description: event.target.value }))
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="report-query-sql">SQL Query</label>
            <textarea
              id="report-query-sql"
              rows={5}
              placeholder="e.g. SELECT * FROM customers WHERE active = true"
              value={form.queryText}
              onChange={(event) => {
                resetTestRun();
                setForm((previous) => ({ ...previous, queryText: event.target.value }));
              }}
            />
          </div>

          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleSaveQuery} disabled={savingQuery}>
              {savingQuery ? "Saving..." : "Save Query"}
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                setTestRunPage(0);
                runTestQuery(0);
              }}
              disabled={!canRunTest || testRunLoading}
            >
              {testRunLoading ? "Running..." : "Test Run"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setForm(initialForm);
                setFormAlert(null);
                resetTestRun();
              }}
            >
              Clear
            </button>
          </div>

          {testRunVisible && (
            <div className="workspace-test-run-area">
              <div className="workspace-test-run-title">Test Run Results</div>

              {testRunAlert && (
                <div className={`alert ${testRunAlert.type} show`}>{testRunAlert.message}</div>
              )}

              {testRunLoading && <div className="spinner show">Running test query...</div>}

              {!testRunLoading && testRunResult && (
                <>
                  <div className="workspace-test-run-summary">
                    <strong>Test passed.</strong> <strong>Total Rows:</strong>{" "}
                    {testRunResult.totalRows} <strong>Page:</strong> {testRunResult.page + 1} of{" "}
                    {testRunResult.totalPages} <strong>Columns:</strong>{" "}
                    {Array.isArray(testRunResult.columns) ? testRunResult.columns.length : 0}
                  </div>

                  {Array.isArray(testRunResult.rows) && testRunResult.rows.length > 0 ? (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            {(Array.isArray(testRunResult.columns)
                              ? testRunResult.columns
                              : []
                            ).map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {testRunResult.rows.map((row, rowIndex) => (
                            <tr
                              key={`${rowIndex}-${Array.isArray(row) ? row.join("|") : rowIndex}`}
                            >
                              {(Array.isArray(row) ? row : []).map((cell, cellIndex) => (
                                <td key={`${rowIndex}-${cellIndex}`}>
                                  {cell === "NULL" ? (
                                    <span style={{ color: "#999", fontStyle: "italic" }}>
                                      NULL
                                    </span>
                                  ) : (
                                    cell
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">Query returned no results.</div>
                  )}

                  {testRunResult.totalPages > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => {
                          if (testRunPage > 0) runTestQuery(testRunPage - 1);
                        }}
                        disabled={testRunPage === 0}
                      >
                        Prev
                      </button>
                      <span>
                        Page {testRunPage + 1} of {testRunResult.totalPages}
                      </span>
                      <button
                        onClick={() => {
                          if (testRunPage < testRunResult.totalPages - 1) {
                            runTestQuery(testRunPage + 1);
                          }
                        }}
                        disabled={testRunPage >= testRunResult.totalPages - 1}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!showAddForm && (
        <div className="card workspace-panel-card">
          <h2 className="card-title">Saved Queries</h2>

          {tableAlert && (
            <div className={`alert ${tableAlert.type} show`}>{tableAlert.message}</div>
          )}

          {tableLoading && <div className="spinner show">Loading saved queries...</div>}

          {!tableLoading && queries.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Connection</th>
                    <th>DB Type</th>
                    <th>Query</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((query, index) => {
                    const queryPreview =
                      query.queryText && query.queryText.length > 80
                        ? `${query.queryText.slice(0, 80)}...`
                        : query.queryText || "—";

                    return (
                      <tr key={query.queryId}>
                        <td>{index + 1}</td>
                        <td>{query.name}</td>
                        <td>{query.description || "—"}</td>
                        <td>{configNameById.get(String(query.configId)) || `#${query.configId}`}</td>
                        <td>
                          <span className="badge badge-info">{query.dbType}</span>
                        </td>
                        <td>
                          <code className="workspace-table-code">{queryPreview}</code>
                        </td>
                        <td>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "6px 14px", fontSize: "12px" }}
                            onClick={() => handleDelete(query.queryId)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!tableLoading && queries.length === 0 && (
            <div className="empty-state">No queries saved yet.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default ReportConfigPanel;
