import React from 'react';

function TableControls({
  domains,
  selectedDomain,
  setSelectedDomain,
  searchTerm,
  setSearchTerm,
  selectedRows,
  bulkTarget,
  setBulkTarget,
  handleBulkUpdate,
}) {
  return (
    <div className="controls">
      <div className="filter-controls">
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="domain-select"
        >
          {domains.map((domain) => (
            <option key={domain} value={domain}>
              {domain === 'all'
                ? 'All Domains'
                : domain.charAt(0).toUpperCase() + domain.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search source or target..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {selectedRows.size > 0 && (
        <div className="bulk-controls">
          <span>{selectedRows.size} selected</span>
          <input
            type="text"
            placeholder="Enter target value"
            value={bulkTarget}
            onChange={(e) => setBulkTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleBulkUpdate();
              }
            }}
            className="bulk-input"
          />
          <button onClick={handleBulkUpdate} className="bulk-update-btn">
            Update Selected
          </button>
        </div>
      )}
    </div>
  );
}

export default TableControls;