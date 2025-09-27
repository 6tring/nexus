import React, { useState } from 'react';
import MappingHistory from './MappingHistory';

function MappingTable({
  filteredMappings,
  selectedRows,
  editingCell,
  validationErrors,
  loading,
  handleSelectAll,
  handleRowSelect,
  handleCellEdit,
  setEditingCell,
  clearValidationError,
  onRefresh, // New prop for refreshing data after rollback
}) {
  const [historyMapping, setHistoryMapping] = useState(null);

  const handleViewHistory = (mapping) => {
    setHistoryMapping(mapping);
  };

  const handleCloseHistory = () => {
    setHistoryMapping(null);
  };

  const handleHistoryRollback = () => {
    // Refresh the mappings data after a successful rollback
    if (onRefresh) {
      onRefresh();
    }
    // Optionally close the history modal
    // setHistoryMapping(null);
  };

  return (
    <>
      <div className="table-container">
        {loading && <div className="loading">Loading...</div>}

        <table className="mappings-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  checked={
                    selectedRows.size === filteredMappings.length &&
                    filteredMappings.length > 0
                  }
                />
              </th>
              <th>Source</th>
              <th>Target</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMappings.map((mapping) => (
              <tr key={mapping.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(mapping.id)}
                    onChange={(e) =>
                      handleRowSelect(mapping.id, e.target.checked)
                    }
                  />
                </td>
                <td className="source-cell">{mapping.source}</td>
                <td className="target-cell">
                  {editingCell === mapping.id ? (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        defaultValue={mapping.target}
                        onBlur={(e) =>
                          handleCellEdit(mapping.id, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCellEdit(mapping.id, e.target.value);
                          } else if (e.key === 'Escape') {
                            setEditingCell(null);
                            clearValidationError(mapping.id);
                          }
                        }}
                        autoFocus
                        className="edit-input"
                        style={{
                          borderColor: validationErrors[mapping.id]
                            ? '#e53e3e'
                            : undefined,
                        }}
                      />
                      {validationErrors[mapping.id] && (
                        <div
                          style={{
                            color: '#e53e3e',
                            fontSize: '0.75rem',
                            marginTop: '2px',
                            position: 'absolute',
                            whiteSpace: 'nowrap',
                            background: 'white',
                            padding: '2px 4px',
                            border: '1px solid #e53e3e',
                            borderRadius: '3px',
                            zIndex: 10,
                          }}
                        >
                          {validationErrors[mapping.id]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span
                      onClick={() => setEditingCell(mapping.id)}
                      className="editable-cell"
                      style={{
                        color: validationErrors[mapping.id]
                          ? '#e53e3e'
                          : 'inherit',
                      }}
                    >
                      {mapping.target || '(empty)'}
                      {validationErrors[mapping.id] && (
                        <span
                          style={{
                            color: '#e53e3e',
                            fontSize: '0.75rem',
                            marginLeft: '8px',
                          }}
                        >
                          ⚠️
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td>{mapping.domain}</td>
                <td>
                  <span className={`status ${mapping.status}`}>
                    {mapping.status}
                  </span>
                </td>
                <td className="actions-cell">
                  <button
                    className="action-btn history-btn"
                    onClick={() => handleViewHistory(mapping)}
                    title="View History"
                  >
                    📜
                  </button>
                  {mapping.deleted_at && (
                    <span className="deleted-indicator" title="Soft Deleted">
                      🗑️
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMappings.length === 0 && !loading && (
          <div className="no-data">No mappings found</div>
        )}
      </div>

      {historyMapping && (
        <MappingHistory
          mappingId={historyMapping.id}
          mappingSource={historyMapping.source}
          onClose={handleCloseHistory}
          onRollback={handleHistoryRollback}
        />
      )}

      <style jsx>{`
        .actions-cell {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .action-btn {
          padding: 0.25rem 0.5rem;
          background: #edf2f7;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 1rem;
        }

        .history-btn:hover {
          background: #e6f3ff;
          border-color: #2c5282;
        }

        .deleted-indicator {
          color: #e53e3e;
          font-size: 1rem;
          cursor: help;
        }

        @media (max-width: 768px) {
          .actions-cell {
            flex-direction: column;
            gap: 0.25rem;
          }

          .action-btn {
            width: 100%;
            min-width: 2rem;
          }
        }
      `}</style>
    </>
  );
}

export default MappingTable;