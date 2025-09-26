import { useState, useEffect } from 'react';
import * as api from '../utils/api';
import { validateTarget } from '../utils/validation';

export function useDataManagement() {
  // Core data state
  const [mappings, setMappings] = useState([]);
  const [filteredMappings, setFilteredMappings] = useState([]);
  const [targets, setTargets] = useState([]);
  
  // Filter and search state
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI state
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [bulkTarget, setBulkTarget] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Domain options
  const domains = [
    'all',
    'account',
    'entity',
    'product',
    'department',
    'location',
  ];

  // Load initial data
  useEffect(() => {
    loadMappings();
    loadTargets();
  }, []);

  // Filter mappings when dependencies change
  useEffect(() => {
    filterMappings();
  }, [mappings, selectedDomain, searchTerm]);

  // Data loading functions
  const loadMappings = async () => {
    setLoading(true);
    try {
      const data = await api.getMappings();
      setMappings(data);
    } catch (error) {
      console.error('Error loading mappings:', error);
    }
    setLoading(false);
  };

  const loadTargets = async () => {
    try {
      const data = await api.getTargets();
      setTargets(data);
    } catch (error) {
      console.error('Error loading targets:', error);
    }
  };

  // Filtering logic
  const filterMappings = () => {
    let filtered = [...mappings];

    if (selectedDomain !== 'all') {
      filtered = filtered.filter((m) => m.domain === selectedDomain);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.source.toLowerCase().includes(search) ||
          (m.target && m.target.toLowerCase().includes(search))
      );
    }

    setFilteredMappings(filtered);
  };

  // Cell editing handler
  const handleCellEdit = async (id, newTarget) => {
    // Find the domain for this mapping
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;

    // Validate the new target value
    const validation = validateTarget(newTarget, mapping.domain);
    if (!validation.valid) {
      // Set error state for this specific cell
      setValidationErrors((prev) => ({
        ...prev,
        [id]: validation.error,
      }));
      return; // Don't save invalid data
    }

    // Clear any existing error for this cell
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[id];
      return newErrors;
    });

    try {
      const updated = await api.updateMapping(id, { target: newTarget });
      setMappings(mappings.map((m) => (m.id === id ? updated : m)));
      setEditingCell(null);
    } catch (error) {
      console.error('Error updating mapping:', error);
      // If backend validation fails, show the error
      if (error.message.includes('400')) {
        setValidationErrors((prev) => ({
          ...prev,
          [id]: 'Invalid format for this domain',
        }));
      }
    }
  };

  // Bulk update handler
  const handleBulkUpdate = async () => {
    console.log('handleBulkUpdate called with:', bulkTarget, selectedRows.size);
    if (!bulkTarget || selectedRows.size === 0) {
      console.log('Aborting: no target or no selected rows');
      return;
    }

    setLoading(true);
    try {
      const ids = Array.from(selectedRows);
      console.log('Calling bulkUpdateMappings with ids:', ids);
      await api.bulkUpdateMappings(ids, { target: bulkTarget });
      console.log('Bulk update successful');
      await loadMappings();
      setSelectedRows(new Set());
      setBulkTarget('');
    } catch (error) {
      console.error('Error bulk updating:', error);
      alert(`Bulk update failed: ${error.message}`);
    }
    setLoading(false);
  };

  // Selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(new Set(filteredMappings.map((m) => m.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleRowSelect = (id, checked) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
  };

  // Import handler
  const handleImport = async (file) => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await api.importMappings(file);

      // Display import results to user
      let message = `Import completed: ${result.imported} records added`;

      if (result.skipped > 0) {
        message += `, ${result.skipped} skipped`;
      }

      if (result.duplicates && result.duplicates.length > 0) {
        message += `\n\nDuplicates found (not imported):\n${result.duplicates
          .slice(0, 5)
          .join('\n')}`;
        if (result.hasMoreDuplicates) {
          message += '\n...and more';
        }
      }

      if (result.errors && result.errors.length > 0) {
        message += `\n\nErrors:\n${result.errors.slice(0, 5).join('\n')}`;
        if (result.hasMoreErrors) {
          message += '\n...and more';
        }
      }

      alert(message); // Simple solution - could be replaced with a better notification system

      await loadMappings();
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Failed to import file. Please check the console for details.');
    }
    setLoading(false);
  };

  // Export handler
  const handleExport = async () => {
    try {
      await api.exportMappings(
        selectedDomain === 'all' ? null : selectedDomain
      );
    } catch (error) {
      console.error('Error exporting mappings:', error);
    }
  };

  // Clear validation error helper
  const clearValidationError = (id) => {
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[id];
      return newErrors;
    });
  };

  // Return all state and handlers for components to use
  return {
    // Data
    mappings,
    filteredMappings,
    targets,
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
    loadMappings,
  };
}