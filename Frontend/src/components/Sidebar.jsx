import { useEffect, useRef } from "react";

function Sidebar({
  searchTerm,
  onSearchTermChange,
  filteredQueries,
  queriesLoading,
  selectedQueryId,
  onRunQuery,
  activeView,
  onShowDbConfig,
  onShowReportConfig,
  onShowAuditLogs,
}) {
  const trimmedSearchTerm = searchTerm.trim();
  const sidebarScrollableRef = useRef(null);

  useEffect(() => {
    if (!sidebarScrollableRef.current) return;
    sidebarScrollableRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchTerm]);

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-scrollable" ref={sidebarScrollableRef}>
        <div className="workspace-sidebar-top">
          <label className="workspace-section-title" htmlFor="sidebar-query-search">
            Search
          </label>
          <input
            id="sidebar-query-search"
            className="workspace-search-input"
            type="text"
            placeholder="Search saved queries..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary workspace-run-button"
            onClick={() => onSearchTermChange("")}
            disabled={searchTerm.length === 0}
          >
            Clear
          </button>
        </div>

        <div className="workspace-sidebar-middle">
          <div className="workspace-section-title">Filtered Results</div>

          {queriesLoading && (
            <div className="workspace-sidebar-state">Loading saved queries...</div>
          )}

          {!queriesLoading && filteredQueries.length === 0 && (
            <div className="workspace-sidebar-state">
              {trimmedSearchTerm
                ? `No query matches "${trimmedSearchTerm}".`
                : "No saved queries found."}
            </div>
          )}

          {!queriesLoading && filteredQueries.length > 0 && (
            <div className="workspace-query-list">
              {filteredQueries.map((query) => (
                <button
                  key={query.queryId}
                  type="button"
                  className={`workspace-query-item ${
                    selectedQueryId === query.queryId ? "active" : ""
                  }`}
                  onClick={() => onRunQuery(query.queryId)}
                >
                  <span className="workspace-query-name">
                    {query.name || `Query #${query.queryId}`}
                  </span>
                  <span className="workspace-query-meta">
                    {query.description || "No description available."}
                  </span>
                  <span className="workspace-query-dbtype">
                    {query.dbType || "Unknown DB Type"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="workspace-sidebar-bottom">
        <button
          type="button"
          className={`workspace-nav-button ${activeView === "db-config" ? "active" : ""}`}
          onClick={onShowDbConfig}
        >
          DB Config
        </button>
        <button
          type="button"
          className={`workspace-nav-button ${activeView === "report-config" ? "active" : ""}`}
          onClick={onShowReportConfig}
        >
          Report Config
        </button>
        <button
          type="button"
          className={`workspace-nav-button ${activeView === "audit-logs" ? "active" : ""}`}
          onClick={onShowAuditLogs}
        >
          Audit Logs
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
