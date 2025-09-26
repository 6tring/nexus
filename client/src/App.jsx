import React from 'react';
import { useDataManagement } from './hooks/useDataManagement';
import MappingTable from './components/MappingTable';
import TableControls from './components/TableControls';
import ImportExport from './components/ImportExport';
import './styles/app.css';

function App() {
  const {
    // Data
    filteredMappings,
    domains,
    
    // Filter state
    selectedDomain,
    setSelectedDomain,
    searchTerm,
    setSearchTerm,
    
    // UI state
    selectedRows,
    loading,
    editingCell,
    setEditingCell,
    bulkTarget,
    setBulkTarget,
    validationErrors,
    
    // Handlers
    handleCellEdit,
    handleBulkUpdate,
    handleSelectAll,
    handleRowSelect,
    handleImport,
    handleExport,
    clearValidationError,
  } = useDataManagement();

  return (
    <div className="app">
      <header className="header">
        <h1>Data Mapping Manager</h1>
        <ImportExport 
          handleImport={handleImport}
          handleExport={handleExport}
        />
      </header>

      <TableControls
        domains={domains}
        selectedDomain={selectedDomain}
        setSelectedDomain={setSelectedDomain}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedRows={selectedRows}
        bulkTarget={bulkTarget}
        setBulkTarget={setBulkTarget}
        handleBulkUpdate={handleBulkUpdate}
      />

      <MappingTable
        filteredMappings={filteredMappings}
        selectedRows={selectedRows}
        editingCell={editingCell}
        validationErrors={validationErrors}
        loading={loading}
        handleSelectAll={handleSelectAll}
        handleRowSelect={handleRowSelect}
        handleCellEdit={handleCellEdit}
        setEditingCell={setEditingCell}
        clearValidationError={clearValidationError}
      />
    </div>
  );
}

export default App;