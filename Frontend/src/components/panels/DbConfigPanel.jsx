import { useCallback, useEffect, useState } from "react";
import {
  deleteDbConfig,
  getAllDbConfigs,
  saveDbConfig,
  testConnection,
} from "../../api/client";

const initialFormState = {
  dbName: "",
  dbType: "",
  host: "",
  port: "",
  databaseName: "",
  username: "",
  password: "",
};

function validateForm(data) {
  if (!data.dbName) return "Configuration name is required.";
  if (!data.dbType) return "Please select a database type.";
  if (!data.host) return "Host is required.";
  if (!data.port || Number.isNaN(data.port) || data.port <= 0) {
    return "Port must be a positive number.";
  }
  if (!data.databaseName) return "Database name is required.";
  if (!data.username) return "Username is required.";
  if (!data.password) return "Password is required.";
  return null;
}

function DbConfigPanel() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [configs, setConfigs] = useState([]);
  const [connectionTested, setConnectionTested] = useState(false);

  const [formAlert, setFormAlert] = useState(null);
  const [tableAlert, setTableAlert] = useState(null);

  const [tableLoading, setTableLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadConfigs = useCallback(async () => {
    setTableLoading(true);
    setTableAlert(null);

    try {
      const result = await getAllDbConfigs();
      if (!Array.isArray(result)) {
        setTableAlert({
          message: "Failed to load configurations.",
          type: "alert-error",
        });
        setConfigs([]);
        return;
      }

      setConfigs(result);
    } catch {
      setTableAlert({
        message: "Failed to load configurations.",
        type: "alert-error",
      });
      setConfigs([]);
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleFieldChange = (field) => (event) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
    setConnectionTested(false);
    setFormAlert(null);
  };

  const resetForm = () => {
    setForm(initialFormState);
    setConnectionTested(false);
  };

  const handleTestConnection = async () => {
    setFormAlert(null);

    const payload = {
      ...form,
      dbName: form.dbName.trim(),
      dbType: form.dbType.trim(),
      host: form.host.trim(),
      port: Number.parseInt(form.port, 10),
      databaseName: form.databaseName.trim(),
      username: form.username.trim(),
      password: form.password.trim(),
    };

    const validationError = validateForm(payload);
    if (validationError) {
      setFormAlert({ message: validationError, type: "alert-error" });
      return;
    }

    setTestingConnection(true);
    try {
      const result = await testConnection(payload);

      if (result.success) {
        setFormAlert({
          message: "Connection successful. You can now save.",
          type: "alert-success",
        });
        setConnectionTested(true);
        return;
      }

      setFormAlert({
        message: "Connection failed. Please check your details.",
        type: "alert-error",
      });
      setConnectionTested(false);
    } catch {
      setFormAlert({
        message: "Could not reach the backend. Is Spring Boot running?",
        type: "alert-error",
      });
      setConnectionTested(false);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setFormAlert(null);

    if (!connectionTested) {
      setFormAlert({
        message: "Please test the connection before saving.",
        type: "alert-error",
      });
      return;
    }

    const payload = {
      ...form,
      dbName: form.dbName.trim(),
      dbType: form.dbType.trim(),
      host: form.host.trim(),
      port: Number.parseInt(form.port, 10),
      databaseName: form.databaseName.trim(),
      username: form.username.trim(),
      password: form.password.trim(),
    };

    setSavingConfig(true);
    try {
      const result = await saveDbConfig(payload);
      if (result.configId) {
        setFormAlert({
          message: "Configuration saved successfully.",
          type: "alert-success",
        });
        resetForm();
        setShowAddForm(false);
        await loadConfigs();
        return;
      }

      setFormAlert({
        message: result.error || "Failed to save configuration.",
        type: "alert-error",
      });
    } catch {
      setFormAlert({
        message: "Something went wrong. Please try again.",
        type: "alert-error",
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this configuration?");
    if (!confirmed) return;

    try {
      const response = await deleteDbConfig(id);
      if (response.ok || response.status === 204) {
        setTableAlert({
          message: "Configuration deleted successfully.",
          type: "alert-success",
        });
        await loadConfigs();
        return;
      }

      let message = "Failed to delete.";
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        message = "Failed to delete.";
      }

      setTableAlert({ message, type: "alert-error" });
    } catch {
      setTableAlert({
        message: "Something went wrong while deleting.",
        type: "alert-error",
      });
    }
  };

  return (
    <section>
      <div className="workspace-panel-header">
        <h1 className="workspace-panel-title">Database Configuration</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShowAddForm((previous) => !previous);
            setFormAlert(null);
          }}
        >
          {showAddForm ? "Close" : "Add Config"}
        </button>
      </div>

      {showAddForm && (
        <div className="card workspace-panel-card">
          <h2 className="card-title">Add New Configuration</h2>

          {formAlert && <div className={`alert ${formAlert.type} show`}>{formAlert.message}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dbName">Configuration Name</label>
              <input
                id="dbName"
                type="text"
                placeholder="e.g. Local Client DB"
                value={form.dbName}
                onChange={handleFieldChange("dbName")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="dbType">Database Type</label>
              <select id="dbType" value={form.dbType} onChange={handleFieldChange("dbType")}>
                <option value="">-- Select Type --</option>
                <option value="MSSQL">MSSQL</option>
                <option value="MYSQL">MySQL</option>
                <option value="POSTGRESQL">PostgreSQL</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="host">Host</label>
              <input
                id="host"
                type="text"
                placeholder="e.g. localhost"
                value={form.host}
                onChange={handleFieldChange("host")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="port">Port</label>
              <input
                id="port"
                type="number"
                placeholder="e.g. 1433"
                value={form.port}
                onChange={handleFieldChange("port")}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="databaseName">Database Name</label>
            <input
              id="databaseName"
              type="text"
              placeholder="e.g. client_db"
              value={form.databaseName}
              onChange={handleFieldChange("databaseName")}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="e.g. sa"
                value={form.username}
                onChange={handleFieldChange("username")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={handleFieldChange("password")}
              />
            </div>
          </div>

          <div className="btn-group">
            <button
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveConfiguration}
              disabled={!connectionTested || savingConfig}
            >
              {savingConfig ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      )}

      {!showAddForm && (
        <div className="card workspace-panel-card">
          <h2 className="card-title">Saved Configurations</h2>

          {tableAlert && (
            <div className={`alert ${tableAlert.type} show`}>{tableAlert.message}</div>
          )}

          {tableLoading && <div className="spinner show">Loading configurations...</div>}

          {!tableLoading && configs.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Config Name</th>
                    <th>DB Type</th>
                    <th>Host</th>
                    <th>Port</th>
                    <th>Database</th>
                    <th>Username</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((config, index) => {
                    const createdAt = config.createdAt
                      ? new Date(config.createdAt).toLocaleString()
                      : "—";

                    return (
                      <tr key={config.configId}>
                        <td>{index + 1}</td>
                        <td>{config.dbName}</td>
                        <td>
                          <span className="badge badge-info">{config.dbType}</span>
                        </td>
                        <td>{config.host}</td>
                        <td>{config.port}</td>
                        <td>{config.databaseName}</td>
                        <td>{config.username}</td>
                        <td>{createdAt}</td>
                        <td>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "6px 14px", fontSize: "12px" }}
                            onClick={() => handleDelete(config.configId)}
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

          {!tableLoading && configs.length === 0 && (
            <div className="empty-state">No configurations saved yet.</div>
          )}
        </div>
      )}
    </section>
  );
}

export default DbConfigPanel;
