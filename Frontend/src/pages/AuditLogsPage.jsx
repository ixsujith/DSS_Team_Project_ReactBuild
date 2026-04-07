import { useEffect, useMemo, useState } from "react";
import { getAllAuditLogs } from "../api/client";

function AuditLogsPage() {
  const [allLogs, setAllLogs] = useState([]);
  const [filterDbType, setFilterDbType] = useState("");
  const [tableAlert, setTableAlert] = useState(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [modalQueryText, setModalQueryText] = useState("");

  const dbTypes = useMemo(
    () => [...new Set(allLogs.map((log) => log.dbType).filter(Boolean))].sort(),
    [allLogs],
  );

  const filteredLogs = useMemo(() => {
    if (!filterDbType) return allLogs;
    return allLogs.filter((log) => log.dbType === filterDbType);
  }, [allLogs, filterDbType]);

  const loadLogs = async () => {
    setTableLoading(true);
    setTableAlert(null);
    try {
      const logs = await getAllAuditLogs();
      if (!Array.isArray(logs)) {
        setTableAlert({
          message: "Failed to load audit logs.",
          type: "alert-error",
        });
        setAllLogs([]);
        return;
      }

      setAllLogs(logs);
    } catch {
      setTableAlert({
        message: "Failed to load audit logs. Is the backend running?",
        type: "alert-error",
      });
      setAllLogs([]);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!modalQueryText) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setModalQueryText("");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalQueryText]);

  useEffect(() => {
    if (!filterDbType) return;
    if (!dbTypes.includes(filterDbType)) {
      setFilterDbType("");
    }
  }, [dbTypes, filterDbType]);

  const isModalOpen = Boolean(modalQueryText);

  return (
    <div className="container">
      <h1 className="page-title">Audit Logs</h1>

      <div className="card">
        <h2 className="card-title">Filter Logs</h2>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div className="form-group" style={{ marginBottom: 0, minWidth: "220px" }}>
            <label htmlFor="filterDbType">Filter by DB Type</label>
            <select
              id="filterDbType"
              value={filterDbType}
              onChange={(event) => setFilterDbType(event.target.value)}
            >
              <option value="">-- All Types --</option>
              {dbTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-secondary"
            onClick={loadLogs}
            style={{ marginBottom: 0 }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Failed Query Log</h2>

        {!tableLoading && filteredLogs.length > 0 && (
          <div
            style={{
              fontSize: "13px",
              color: "#555",
              marginBottom: "16px",
            }}
          >
            <strong>{filteredLogs.length}</strong> failure
            {filteredLogs.length > 1 ? "s" : ""}
            {filterDbType ? (
              <>
                {" "}
                logged for <strong>{filterDbType}</strong>.
              </>
            ) : (
              " logged across all DB types."
            )}
          </div>
        )}

        {tableAlert && (
          <div className={`alert ${tableAlert.type} show`}>{tableAlert.message}</div>
        )}

        {tableLoading && <div className="spinner show">Loading audit logs...</div>}

        {!tableLoading && filteredLogs.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Timestamp</th>
                  <th>DB Type</th>
                  <th>Query Text</th>
                  <th>Error Message</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => {
                  const timestamp = log.timestamp
                    ? new Date(log.timestamp).toLocaleString()
                    : "—";

                  const queryText = log.queryText || "";
                  const queryPreview =
                    queryText.length > 60 ? `${queryText.slice(0, 60)}...` : queryText;

                  const errorText = log.errorMessage || "";
                  const errorPreview =
                    errorText.length > 80 ? `${errorText.slice(0, 80)}...` : errorText;

                  return (
                    <tr key={`${log.timestamp}-${log.queryText}-${index}`}>
                      <td>{index + 1}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{timestamp}</td>
                      <td>
                        <span className="badge badge-error">{log.dbType}</span>
                      </td>
                      <td>
                        <code
                          style={{
                            background: "#f0f2f5",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            color: "#1e3a5f",
                            display: "block",
                            maxWidth: "280px",
                          }}
                        >
                          {queryPreview}
                        </code>
                        {queryText.length > 60 && (
                          <button
                            onClick={() => setModalQueryText(queryText)}
                            style={{
                              marginTop: "4px",
                              background: "none",
                              border: "none",
                              color: "#1e3a5f",
                              fontSize: "12px",
                              cursor: "pointer",
                              textDecoration: "underline",
                              padding: 0,
                            }}
                          >
                            View full query
                          </button>
                        )}
                      </td>
                      <td
                        style={{
                          color: "#721c24",
                          fontSize: "13px",
                          maxWidth: "300px",
                        }}
                      >
                        {errorPreview}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!tableLoading && filteredLogs.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>OK</div>
            <div>No failures logged. Everything is running clean.</div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          onClick={() => setModalQueryText("")}
          style={{
            display: "flex",
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 100,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "10px",
              padding: "28px",
              maxWidth: "640px",
              width: "90%",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 style={{ fontSize: "16px", color: "#1e3a5f", fontWeight: 700 }}>
                Full Query Text
              </h3>
              <button
                onClick={() => setModalQueryText("")}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#888",
                  lineHeight: 1,
                }}
              >
                x
              </button>
            </div>

            <pre
              style={{
                background: "#f0f2f5",
                border: "1px solid #d1d9e0",
                borderRadius: "6px",
                padding: "14px 16px",
                fontFamily: '"Courier New", monospace',
                fontSize: "13px",
                color: "#1e3a5f",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                marginBottom: "16px",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {modalQueryText}
            </pre>

            <div style={{ textAlign: "right" }}>
              <button className="btn btn-secondary" onClick={() => setModalQueryText("")}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogsPage;
