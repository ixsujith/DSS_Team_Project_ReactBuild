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

function QueryResultPanel({
  selectedQuery,
  executionAlert,
  executionLoading,
  executionResult,
  emptyStateMessage,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <section>
      <div className="workspace-panel-header">
        <h1 className="workspace-panel-title">Query Execution</h1>
      </div>

      {selectedQuery && (
        <div className="workspace-selected-query">
          <div className="workspace-selected-query-label">Selected Query</div>
          <div className="workspace-selected-query-name">{selectedQuery.name}</div>
          <pre className="workspace-code-block">{selectedQuery.queryText}</pre>
        </div>
      )}

      {executionAlert && (
        <div className={`alert ${executionAlert.type} show`}>{executionAlert.message}</div>
      )}

      {!selectedQuery && !executionLoading && !executionResult && (
        <div className="empty-state">{emptyStateMessage}</div>
      )}

      {selectedQuery && (
        <div className="workspace-result-toolbar">
          <div
            className="form-group"
            style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}
          >
            <label style={{ margin: 0, whiteSpace: "nowrap" }}>Rows per page</label>
            <select
              value={pageSize}
              onChange={(event) => {
                const nextPageSize = Number.parseInt(event.target.value, 10);
                onPageSizeChange(nextPageSize);
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
      )}

      {executionResult && (
        <div className="workspace-result-summary">
          <span>
            <strong>Total Rows:</strong> {executionResult.totalRows}
          </span>
          <span>
            <strong>Page:</strong> {executionResult.page + 1} of {executionResult.totalPages}
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

      {!executionLoading && executionResult && executionResult.totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => {
              if (currentPage > 0) {
                onPageChange(currentPage - 1);
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
                onPageChange(currentPage + 1);
              }
            }}
            disabled={currentPage >= executionResult.totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

export default QueryResultPanel;
