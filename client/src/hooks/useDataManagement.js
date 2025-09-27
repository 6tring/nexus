import { useState, useEffect } from 'react';
import * as api from '../utils/api';
import { validateTarget } from '../utils/validation';

export function useDataManagement() {
  // Core data state
  const [mappings, setMappings] = useState([]);
  const [filteredMappings, setFilteredMappings] = useState([]);
  const [targets, setTargets] = useState([]);
  
  // NEW: Source tracking state
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');
  const [sourceStats, setSourceStats] = useState({ total: 0, bySource: {} });
  
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
    loadSources(); // NEW: Load available sources
  }, []);

  // Filter mappings when dependencies change (added selectedSource)
  useEffect(() => {
    filterMappings();
  }, [mappings, selectedDomain, searchTerm, selectedSource]);

  // Reload mappings when source changes
  useEffect(() => {
    if (selectedSource !== undefined) {
      loadMappings();
    }
  }, [selectedSource]);

  // NEW: Load available data sources
  const loadSources = async () => {
    try {
      const data = await api.getSources();
      setSources(data.sources || []);
      setSourceStats({ 
        total: data.total || 0, 
        bySource: data.sources?.reduce((acc, src) => {
          acc[src.name] = src.count;
          return acc;
        }, {}) || {}
      });
    } catch (error) {
      console.error('Error loading sources:', error);
      // Set default if API fails
      setSources([{ name: 'all', displayName: 'All Sources', count: 0 }]);
    }
  };

  // Data loading functions (enhanced with source filtering)
  const loadMappings = async () => {
    setLoading(true);
    try {
      const params = {};
      // Only add source filter if not 'all'
      if (selectedSource && selectedSource !== 'all') {
        params.dataSource = selectedSource;
      }
      const data = await api.getMappings(params);
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

  // Filtering logic (now includes source consideration)
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

    // Note: Source filtering happens at API level, not here
    // This ensures we get correct counts and performance

    setFilteredMappings(filtered);
  };

  // NEW: Handle source change
  const handleSourceChange = (newSource) => {
    setSelectedSource(newSource);
    // Clear selections when changing source
    setSelectedRows(new Set());
  };

  // NEW: Clear sample data handler (actually clears ALL data)
  const handleClearSampleData = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL mappings from all sources. This action cannot be undone. Are you sure you want to continue?')) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await api.clearSampleData();
      
      if (result.deletedCount === 0) {
        alert('No data to clear.');
      } else {
        alert(`Successfully deleted ${result.deletedCount} mapping(s)`);
      }
      
      // Reload sources and mappings
      await loadSources();
      await loadMappings();
      
      // Reset to 'all' view since we deleted everything
      setSelectedSource('all');
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data');
    }
    setLoading(false);
  };

  // NEW: Delete a specific data source
  const handleDeleteSource = async (sourceName) => {
    // Get source info for confirmation message
    const sourceInfo = sources.find(s => s.name === sourceName);
    const count = sourceInfo ? sourceInfo.count : 0;
    const displayName = sourceInfo ? sourceInfo.displayName : sourceName;
    
    if (!window.confirm(`Are you sure you want to delete "${displayName}"?\nThis will remove ${count} mapping(s). This action cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await api.deleteSource(sourceName);
      
      if (result.deletedCount === 0) {
        alert('No mappings found for this source.');
      } else {
        alert(`Successfully deleted ${result.deletedCount} mapping(s) from "${displayName}"`);
      }
      
      // Reload sources and mappings
      await loadSources();
      
      // If we were viewing the deleted source, switch to all
      if (selectedSource === sourceName) {
        setSelectedSource('all');
      } else {
        await loadMappings();
      }
    } catch (error) {
      console.error('Error deleting source:', error);
      alert('Failed to delete data source. Please try again.');
    }
    setLoading(false);
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

  // Import handler (enhanced to show source info)
  const handleImport = async (file) => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await api.importMappings(file);

      // Display import results to user (enhanced with source info)
      let message = `Import completed: ${result.imported} records added`;
      
      if (result.dataSource) {
        message += `\nData source: ${result.dataSource}`;
      }

      if (result.skipped > 0) {
        message += `\n${result.skipped} skipped`;
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

      // Reload sources to get updated counts
      await loadSources();
      await loadMappings();
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Failed to import file. Please check the console for details.');
    }
    setLoading(false);
  };

  // Export handler (enhanced with source support)
  const handleExport = async () => {
    try {
      const domain = selectedDomain === 'all' ? null : selectedDomain;
      const source = selectedSource === 'all' ? null : selectedSource;
      await api.exportMappings(domain, source);
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
    
    // NEW: Source-related data
    sources,
    selectedSource,
    sourceStats,
    
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
    
    // NEW: Source-related handlers
    handleSourceChange,
    handleClearSampleData,
    handleDeleteSource,
    loadSources,
  };
}