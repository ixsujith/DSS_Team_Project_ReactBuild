import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  executeTempQuery,
  getAllDbConfigs,
  getAllDbTypes,
  getConfigsByDbType,
  getSchemaColumns,
  getSchemaTables,
  saveQuery,
} from "../api/client";

const disabledBuilderStepStyle = {
  opacity: 0.4,
  pointerEvents: "none",
};

function QueryManagementPage() {
  const [dbTypes, setDbTypes] = useState([]);

  const [form, setForm] = useState({
    name: "",
    dbType: "",
    configId: "",
    description: "",
    queryText: "",
  });
  const [formAlert, setFormAlert] = useState(null);
  const [savingQuery, setSavingQuery] = useState(false);

  const [testRunVisible, setTestRunVisible] = useState(false);
  const [testRunAlert, setTestRunAlert] = useState(null);
  const [testRunLoading, setTestRunLoading] = useState(false);
  const [testRunResult, setTestRunResult] = useState(null);
  const [testRunPage, setTestRunPage] = useState(0);

  const [allConfigs, setAllConfigs] = useState([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderAlert, setBuilderAlert] = useState(null);
  const [builderDbType, setBuilderDbType] = useState("");
  const [builderConnections, setBuilderConnections] = useState([]);
  const [builderConnectionsLoading, setBuilderConnectionsLoading] = useState(false);
  const [builderConfigId, setBuilderConfigId] = useState("");
  const [builderTables, setBuilderTables] = useState([]);
  const [builderTablesLoading, setBuilderTablesLoading] = useState(false);
  const [builderTable, setBuilderTable] = useState("");
  const [builderColumns, setBuilderColumns] = useState([]);
  const [builderColumnsLoading, setBuilderColumnsLoading] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [joinRows, setJoinRows] = useState([]);
  const [whereRows, setWhereRows] = useState([]);

  const joinCounterRef = useRef(0);
  const whereCounterRef = useRef(0);
  const queryNameInputRef = useRef(null);

  const canRunTest = Boolean(form.configId && form.queryText.trim());
  const builderStep2Enabled = Boolean(builderConfigId);
  const builderStep3Enabled = Boolean(builderTable);

  const formConnections = useMemo(() => {
    if (!form.dbType) return [];
    return allConfigs.filter(
      (config) => (config.dbType || "").toUpperCase() === form.dbType.toUpperCase(),
    );
  }, [allConfigs, form.dbType]);

  const generatedSql = useMemo(() => {
    if (!builderTable) {
      return "Select a table to generate SQL...";
    }

    const columnPart = selectedColumns.length > 0 ? selectedColumns.join(", ") : "*";

    const joinClauses = joinRows
      .filter((join) => join.joinType && join.table && join.leftColumn && join.rightColumn)
      .map(
        (join) =>
          `${join.joinType} ${join.table} ON ${join.leftColumn} = ${join.rightColumn}`,
      );

    const whereClauses = whereRows
      .map((where) => {
        if (!where.column || !where.operator) return null;
        if (where.operator === "IS NULL" || where.operator === "IS NOT NULL") {
          return `${where.column} ${where.operator}`;
        }

        const rawValue = where.value.trim();
        if (!rawValue) return null;

        const isNumeric = !Number.isNaN(Number(rawValue));
        if (isNumeric) {
          return `${where.column} ${where.operator} ${rawValue}`;
        }

        const escaped = rawValue.replaceAll("'", "''");
        return `${where.column} ${where.operator} '${escaped}'`;
      })
      .filter(Boolean);

    let sql = `SELECT ${columnPart}\nFROM ${builderTable}`;
    if (joinClauses.length > 0) {
      sql += `\n${joinClauses.join("\n")}`;
    }
    if (whereClauses.length > 0) {
      sql += `\nWHERE ${whereClauses.join("\n  AND ")}`;
    }

    return sql;
  }, [builderTable, joinRows, selectedColumns, whereRows]);

  const resetTestRun = useCallback(() => {
    setTestRunVisible(false);
    setTestRunAlert(null);
    setTestRunLoading(false);
    setTestRunResult(null);
    setTestRunPage(0);
  }, []);

  const loadDbTypes = useCallback(async () => {
    try {
      const types = await getAllDbTypes();
      if (!Array.isArray(types)) {
        setDbTypes([]);
        return;
      }
      setDbTypes(types);
    } catch {
      setFormAlert({
        message: "Failed to load DB types. Is the backend running?",
        type: "alert-error",
      });
    }
  }, []);

  const loadConfigs = useCallback(async () => {
    try {
      const configs = await getAllDbConfigs();
      setAllConfigs(Array.isArray(configs) ? configs : []);
    } catch {
      setAllConfigs([]);
    }
  }, []);

  useEffect(() => {
    loadDbTypes();
    loadConfigs();
  }, [loadConfigs, loadDbTypes]);

  const runTestQuery = useCallback(
    async (page) => {
      const queryText = form.queryText.trim();
      const configId = Number.parseInt(form.configId, 10);

      if (!queryText) {
        setTestRunAlert({
          message: "Please enter a SQL query first.",
          type: "alert-error",
        });
        return;
      }

      if (!configId) {
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

  const resetBuilderState = () => {
    setBuilderAlert(null);
    setBuilderDbType("");
    setBuilderConnections([]);
    setBuilderConnectionsLoading(false);
    setBuilderConfigId("");
    setBuilderTables([]);
    setBuilderTablesLoading(false);
    setBuilderTable("");
    setBuilderColumns([]);
    setBuilderColumnsLoading(false);
    setSelectedColumns([]);
    setJoinRows([]);
    setWhereRows([]);
    joinCounterRef.current = 0;
    whereCounterRef.current = 0;
  };

  const handleBuilderDbTypeChange = async (event) => {
    const value = event.target.value;
    setBuilderAlert(null);
    setBuilderDbType(value);
    setBuilderConfigId("");
    setBuilderTables([]);
    setBuilderTable("");
    setBuilderColumns([]);
    setSelectedColumns([]);
    setJoinRows([]);
    setWhereRows([]);
    setBuilderConnections([]);
    joinCounterRef.current = 0;
    whereCounterRef.current = 0;

    if (!value) return;

    setBuilderConnectionsLoading(true);
    try {
      const configs = await getConfigsByDbType(value);
      const safeConfigs = Array.isArray(configs) ? configs : [];
      setBuilderConnections(safeConfigs);
      if (safeConfigs.length === 0) {
        setBuilderAlert({
          message: `No connections found for "${value}".`,
          type: "alert-info",
        });
      }
    } catch {
      setBuilderAlert({
        message: "Failed to load connections.",
        type: "alert-error",
      });
    } finally {
      setBuilderConnectionsLoading(false);
    }
  };

  const handleBuilderConnectionChange = async (event) => {
    const value = event.target.value;
    setBuilderAlert(null);
    setBuilderConfigId(value);
    setBuilderTables([]);
    setBuilderTable("");
    setBuilderColumns([]);
    setSelectedColumns([]);
    setJoinRows([]);
    setWhereRows([]);
    joinCounterRef.current = 0;
    whereCounterRef.current = 0;

    if (!value) return;

    setBuilderTablesLoading(true);
    try {
      const tables = await getSchemaTables(Number(value));
      const safeTables = Array.isArray(tables) ? tables : [];
      setBuilderTables(safeTables);
      if (safeTables.length === 0) {
        setBuilderAlert({
          message: "No tables found for the selected connection.",
          type: "alert-info",
        });
      }
    } catch {
      setBuilderAlert({ message: "Failed to load tables.", type: "alert-error" });
    } finally {
      setBuilderTablesLoading(false);
    }
  };

  const handleBuilderTableChange = async (event) => {
    const table = event.target.value;
    setBuilderAlert(null);
    setBuilderTable(table);
    setBuilderColumns([]);
    setBuilderColumnsLoading(false);
    setSelectedColumns([]);
    setJoinRows([]);
    setWhereRows([]);
    joinCounterRef.current = 0;
    whereCounterRef.current = 0;

    if (!table || !builderConfigId) return;

    setBuilderColumnsLoading(true);
    try {
      const columns = await getSchemaColumns(Number(builderConfigId), table);
      setBuilderColumns(Array.isArray(columns) ? columns : []);
    } catch {
      setBuilderAlert({ message: "Failed to load columns.", type: "alert-error" });
      setBuilderColumns([]);
    } finally {
      setBuilderColumnsLoading(false);
    }
  };

  const toggleSelectedColumn = (column) => {
    setSelectedColumns((previous) => {
      if (previous.includes(column)) {
        return previous.filter((item) => item !== column);
      }
      return [...previous, column];
    });
  };

  const addJoinRow = () => {
    joinCounterRef.current += 1;
    setJoinRows((previous) => [
      ...previous,
      {
        id: `join_${joinCounterRef.current}`,
        joinType: "INNER JOIN",
        table: "",
        leftColumn: "",
        rightColumn: "",
        rightColumns: [],
      },
    ]);
  };

  const updateJoinRow = (rowId, updates) => {
    setJoinRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    );
  };

  const handleJoinTableChange = async (rowId, tableName) => {
    updateJoinRow(rowId, {
      table: tableName,
      rightColumn: "",
      rightColumns: [],
    });

    if (!tableName || !builderConfigId) return;

    try {
      const columns = await getSchemaColumns(Number(builderConfigId), tableName);
      const safeColumns = Array.isArray(columns)
        ? columns.map((column) => `${tableName}.${column}`)
        : [];
      updateJoinRow(rowId, { rightColumns: safeColumns });
    } catch {
      updateJoinRow(rowId, { rightColumns: [] });
    }
  };

  const addWhereRow = () => {
    whereCounterRef.current += 1;
    setWhereRows((previous) => [
      ...previous,
      {
        id: `where_${whereCounterRef.current}`,
        column: "",
        operator: "=",
        value: "",
      },
    ]);
  };

  const updateWhereRow = (rowId, updates) => {
    setWhereRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    );
  };

  const removeJoinRow = (rowId) => {
    setJoinRows((previous) => previous.filter((row) => row.id !== rowId));
  };

  const removeWhereRow = (rowId) => {
    setWhereRows((previous) => previous.filter((row) => row.id !== rowId));
  };

  const handleUseGeneratedQuery = async () => {
    if (!builderTable) {
      setBuilderAlert({ message: "Please select a table first.", type: "alert-error" });
      return;
    }

    setForm((previous) => ({
      ...previous,
      queryText: generatedSql,
      dbType: builderDbType || previous.dbType,
      configId: builderConfigId ? String(builderConfigId) : previous.configId,
    }));

    setBuilderOpen(false);
    queryNameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      queryNameInputRef.current?.focus();
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
        setForm({
          name: "",
          dbType: "",
          configId: "",
          description: "",
          queryText: "",
        });
        resetTestRun();
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

  return (
    <div className="container query-management-page">
      <h1 className="page-title">Query Management</h1>

      <div className="card">
        <div
          className={`builder-toggle ${builderOpen ? "open" : ""}`}
          onClick={() => setBuilderOpen((previous) => !previous)}
        >
          <span className="toggle-icon">▶</span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e3a5f" }}>
            Visual Query Builder
          </span>
          <span style={{ fontSize: "12px", color: "#888", marginLeft: "4px" }}>
            build a query without writing SQL
          </span>
        </div>

        <div className={`builder-body ${builderOpen ? "open" : ""}`}>
          {builderAlert && (
            <div className={`alert ${builderAlert.type} show`}>{builderAlert.message}</div>
          )}

          <div className="builder-section">
            <div className="builder-section-title">
              <span className="builder-section-badge">1</span>
              Select Connection
            </div>
            <div className="form-row">
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="builderDbType">Database Type</label>
                <select
                  id="builderDbType"
                  value={builderDbType}
                  onChange={handleBuilderDbTypeChange}
                >
                  <option value="">-- Select DB Type --</option>
                  {dbTypes.map((type) => (
                    <option key={`builder-${type}`} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="builderConnection">Connection</label>
                <select
                  id="builderConnection"
                  value={builderConfigId}
                  onChange={handleBuilderConnectionChange}
                  disabled={!builderDbType || builderConnectionsLoading}
                >
                  {!builderDbType ? (
                    <option value="">-- Select DB Type first --</option>
                  ) : builderConnectionsLoading ? (
                    <option value="">-- Loading... --</option>
                  ) : (
                    <>
                      <option value="">-- Select Connection --</option>
                      {builderConnections.map((config) => (
                        <option key={config.configId} value={config.configId}>
                          {config.dbName}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div
            className="builder-section"
            style={builderStep2Enabled ? undefined : disabledBuilderStepStyle}
          >
            <div className="builder-section-title">
              <span className="builder-section-badge">2</span>
              Select Table
            </div>
            <div className="form-group" style={{ margin: 0, maxWidth: "300px" }}>
              <select
                value={builderTable}
                onChange={handleBuilderTableChange}
                disabled={!builderConfigId || builderTablesLoading}
              >
                {!builderConfigId ? (
                  <option value="">-- Select a connection first --</option>
                ) : builderTablesLoading ? (
                  <option value="">-- Loading tables... --</option>
                ) : (
                  <>
                    <option value="">-- Select Table --</option>
                    {builderTables.map((table) => (
                      <option key={table} value={table}>
                        {table}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <div
            className="builder-section"
            style={builderStep3Enabled ? undefined : disabledBuilderStepStyle}
          >
            <div className="builder-section-title">
              <span className="builder-section-badge">3</span>
              Select Columns
              <span style={{ fontWeight: 400, color: "#888", fontSize: "12px" }}>
                (leave all unchecked to select *)
              </span>
            </div>

            {builderColumnsLoading ? (
              <span style={{ color: "#888", fontSize: "13px" }}>Loading columns...</span>
            ) : builderColumns.length === 0 ? (
              <span style={{ color: "#888", fontSize: "13px" }}>
                Select a table to see columns
              </span>
            ) : (
              <div className="column-checkboxes">
                {builderColumns.map((column) => (
                  <label key={column} className="column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column)}
                      onChange={() => toggleSelectedColumn(column)}
                    />
                    {column}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div
            className="builder-section"
            style={builderStep3Enabled ? undefined : disabledBuilderStepStyle}
          >
            <div className="builder-section-title">
              <span className="builder-section-badge">4</span>
              Add JOIN
              <span style={{ fontWeight: 400, color: "#888", fontSize: "12px" }}>
                (optional)
              </span>
            </div>

            {joinRows.map((join) => (
              <div key={join.id} className="join-row">
                <select
                  value={join.joinType}
                  onChange={(event) =>
                    updateJoinRow(join.id, { joinType: event.target.value })
                  }
                >
                  <option value="INNER JOIN">INNER JOIN</option>
                  <option value="LEFT JOIN">LEFT JOIN</option>
                  <option value="RIGHT JOIN">RIGHT JOIN</option>
                </select>

                <select
                  value={join.table}
                  onChange={(event) => handleJoinTableChange(join.id, event.target.value)}
                >
                  <option value="">-- Table --</option>
                  {builderTables.map((table) => (
                    <option key={`${join.id}-${table}`} value={table}>
                      {table}
                    </option>
                  ))}
                </select>

                <select
                  value={join.leftColumn}
                  onChange={(event) =>
                    updateJoinRow(join.id, { leftColumn: event.target.value })
                  }
                >
                  <option value="">-- Left column --</option>
                  {builderColumns.map((column) => {
                    const fullColumn = `${builderTable}.${column}`;
                    return (
                      <option key={`${join.id}-${fullColumn}`} value={fullColumn}>
                        {fullColumn}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={join.rightColumn}
                  onChange={(event) =>
                    updateJoinRow(join.id, { rightColumn: event.target.value })
                  }
                >
                  <option value="">-- Right column --</option>
                  {join.rightColumns.map((column) => (
                    <option key={`${join.id}-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>

                <button className="remove-btn" onClick={() => removeJoinRow(join.id)}>
                  x
                </button>
              </div>
            ))}

            <button className="add-row-btn" onClick={addJoinRow}>
              + Add JOIN
            </button>
          </div>

          <div
            className="builder-section"
            style={builderStep3Enabled ? undefined : disabledBuilderStepStyle}
          >
            <div className="builder-section-title">
              <span className="builder-section-badge">5</span>
              Add WHERE Conditions
              <span style={{ fontWeight: 400, color: "#888", fontSize: "12px" }}>
                (optional)
              </span>
            </div>

            {whereRows.map((where) => (
              <div key={where.id} className="where-row">
                <select
                  value={where.column}
                  onChange={(event) =>
                    updateWhereRow(where.id, { column: event.target.value })
                  }
                >
                  <option value="">-- Column --</option>
                  {builderColumns.map((column) => {
                    const fullColumn = `${builderTable}.${column}`;
                    return (
                      <option key={`${where.id}-${fullColumn}`} value={fullColumn}>
                        {fullColumn}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={where.operator}
                  onChange={(event) =>
                    updateWhereRow(where.id, { operator: event.target.value })
                  }
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">{">"}</option>
                  <option value="<">{"<"}</option>
                  <option value=">=">{">="}</option>
                  <option value="<=">{"<="}</option>
                  <option value="LIKE">LIKE</option>
                  <option value="IS NULL">IS NULL</option>
                  <option value="IS NOT NULL">IS NOT NULL</option>
                </select>

                <input
                  type="text"
                  value={where.value}
                  placeholder="value"
                  onChange={(event) =>
                    updateWhereRow(where.id, { value: event.target.value })
                  }
                  disabled={where.operator === "IS NULL" || where.operator === "IS NOT NULL"}
                />

                <button className="remove-btn" onClick={() => removeWhereRow(where.id)}>
                  x
                </button>
              </div>
            ))}

            <button className="add-row-btn" onClick={addWhereRow}>
              + Add Condition
            </button>
          </div>

          <div
            className="builder-section"
            style={builderStep3Enabled ? undefined : disabledBuilderStepStyle}
          >
            <div className="builder-section-title">
              <span className="builder-section-badge">6</span>
              Generated SQL
            </div>
            <pre className="generated-sql-box">{generatedSql}</pre>

            <div className="btn-group" style={{ marginTop: "14px" }}>
              <button className="btn btn-primary" onClick={handleUseGeneratedQuery}>
                Use This Query
              </button>
              <button className="btn btn-secondary" onClick={resetBuilderState}>
                Reset Builder
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Add New Query</h2>
        {formAlert && <div className={`alert ${formAlert.type} show`}>{formAlert.message}</div>}

        <div className="form-row form-row-three">
          <div className="form-group">
            <label htmlFor="queryName">Query Name</label>
            <input
              ref={queryNameInputRef}
              id="queryName"
              type="text"
              placeholder="e.g. All Employees"
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, name: event.target.value }))
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="formDbType">Database Type</label>
            <select
              id="formDbType"
              value={form.dbType}
              onChange={(event) => {
                const value = event.target.value;
                setForm((previous) => ({ ...previous, dbType: value, configId: "" }));
                resetTestRun();
              }}
            >
              <option value="">-- Select DB Type --</option>
              {dbTypes.map((type) => (
                <option key={`form-dbtype-${type}`} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="configId">Connection</label>
            <select
              id="configId"
              value={form.configId}
              onChange={(event) => {
                const value = event.target.value;
                setForm((previous) => ({ ...previous, configId: value }));
                resetTestRun();
              }}
              disabled={!form.dbType}
            >
              {!form.dbType ? (
                <option value="">-- Select DB Type first --</option>
              ) : (
                <>
                  <option value="">-- Select Connection --</option>
                  {formConnections.map((config) => (
                    <option key={`form-config-${config.configId}`} value={config.configId}>
                      {config.dbName}
                    </option>
                  ))}
                </>
              )}
            </select>
            {form.dbType && formConnections.length === 0 && (
              <div style={{ fontSize: "12px", color: "#888", marginTop: "6px" }}>
                No connections found for selected DB type.
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            type="text"
            placeholder="e.g. Fetches all records from employees table"
            value={form.description}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, description: event.target.value }))
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="queryText">SQL Query</label>
          <textarea
            id="queryText"
            rows={5}
            placeholder="e.g. SELECT * FROM employees"
            value={form.queryText}
            onChange={(event) => {
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
            disabled={!canRunTest}
          >
            Test Run
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setForm({
                name: "",
                dbType: "",
                configId: "",
                description: "",
                queryText: "",
              });
              resetTestRun();
              setFormAlert(null);
            }}
          >
            Clear
          </button>
        </div>

        {testRunVisible && (
          <div className="test-run-area">
            <div className="test-run-title">Test Run Results</div>

            {testRunAlert && (
              <div className={`alert ${testRunAlert.type} show`}>{testRunAlert.message}</div>
            )}

            {testRunLoading && <div className="spinner show">Running test query...</div>}

            {!testRunLoading && testRunResult && (
              <>
                <div className="test-run-summary">
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

    </div>
  );
}

export default QueryManagementPage;
