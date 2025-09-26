import React from 'react';

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
}) {
  return (
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
            </tr>
          ))}
        </tbody>
      </table>

      {filteredMappings.length === 0 && !loading && (
        <div className="no-data">No mappings found</div>
      )}
    </div>
  );
}

export default MappingTable;