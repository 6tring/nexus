import React, { useState, useRef, useEffect } from 'react';

function SourceSelector({ 
  sources = [], 
  selectedSource = 'all', 
  onSourceChange,
  sourceStats = { total: 0 },
  onClearSampleData,
  onDeleteSource,
  loading = false 
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [hoveredSource, setHoveredSource] = useState(null);
  const dropdownRef = useRef(null);
  
  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    // Only add listener when menu is open
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMenu]);
  
  // Find the current source object
  const currentSource = sources.find(s => s.name === selectedSource) || 
    { name: 'all', displayName: 'All Sources', count: sourceStats.total };

  // Format the display text
  const getSourceLabel = () => {
    if (!currentSource) return 'All Sources';
    
    // For import sources, format the timestamp nicely
    if (currentSource.name.startsWith('import_')) {
      return currentSource.displayName || currentSource.name;
    }
    
    return currentSource.displayName || currentSource.name;
  };

  // Handle source selection
  const handleSelect = (sourceName) => {
    if (onSourceChange) {
      onSourceChange(sourceName);
    }
    setShowMenu(false);
  };

  // Handle source deletion
  const handleDelete = (event, sourceName) => {
    event.stopPropagation(); // Prevent selecting the source
    if (onDeleteSource) {
      onDeleteSource(sourceName);
    }
    setShowMenu(false);
  };

  // Count non-'all' sources
  const sourceCount = sources.filter(s => s.name !== 'all').length;

  // Check if a source can be deleted (only import sources)
  const canDelete = (sourceName) => {
    return sourceName.startsWith('import_');
  };

  return (
    <div className="source-selector">
      <div className="source-info">
        <span className="source-label">Viewing:</span>
        <div className="source-dropdown" ref={dropdownRef}>
          <button 
            className="source-button"
            onClick={() => setShowMenu(!showMenu)}
            disabled={loading}
          >
            <span className="source-name">{getSourceLabel()}</span>
            <span className="source-count">
              ({currentSource.count || 0} mappings)
            </span>
            <span className="dropdown-arrow">▼</span>
          </button>
          
          {showMenu && (
            <div className="source-menu">
              {sources.map((source) => (
                <div
                  key={source.name}
                  className={`source-option ${source.name === selectedSource ? 'selected' : ''}`}
                  onClick={() => handleSelect(source.name)}
                  onMouseEnter={() => setHoveredSource(source.name)}
                  onMouseLeave={() => setHoveredSource(null)}
                >
                  <span className="option-name">
                    {source.displayName || source.name}
                  </span>
                  <div className="option-right">
                    <span className="option-count">{source.count}</span>
                    {canDelete(source.name) && hoveredSource === source.name && (
                      <button
                        className="delete-button"
                        onClick={(e) => handleDelete(e, source.name)}
                        title="Delete this import"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Always show Clear Sample Data option */}
              <div className="source-menu-divider"></div>
              <div
                className="source-option danger"
                onClick={() => {
                  setShowMenu(false);
                  if (onClearSampleData) {
                    onClearSampleData();
                  }
                }}
              >
                <span className="option-name">Clear Sample Data</span>
                <span className="option-icon">🗑️</span>
              </div>
            </div>
          )}
        </div>
        
        {sourceCount > 1 && (
          <span className="source-summary">
            {sourceCount} data sources available
          </span>
        )}
      </div>
      
      <style jsx>{`
        .source-selector {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .source-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }

        .source-label {
          color: #666;
          font-weight: 500;
        }

        .source-dropdown {
          position: relative;
        }

        .source-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .source-button:hover:not(:disabled) {
          border-color: #007bff;
          background: #f8f9fa;
        }

        .source-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .source-name {
          font-weight: 500;
          color: #333;
        }

        .source-count {
          color: #666;
          font-size: 13px;
        }

        .dropdown-arrow {
          color: #999;
          font-size: 10px;
          margin-left: 4px;
        }

        .source-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          width: 350px;
          min-width: 350px;
          max-width: 350px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          z-index: 1000;
          max-height: 300px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .source-option {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.2s;
          min-height: 36px;
        }

        .source-option:hover {
          background: #f8f9fa;
        }

        .source-option.selected {
          background: #e7f3ff;
          color: #007bff;
        }

        .source-option.danger {
          color: #dc3545;
        }

        .source-option.danger:hover {
          background: #fff5f5;
        }

        .option-name {
          font-size: 14px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
          padding-right: 10px;
        }

        .option-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .option-count {
          font-size: 12px;
          color: #999;
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .option-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .delete-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          padding: 0;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .delete-button:hover {
          background: #c82333;
          transform: scale(1.1);
        }

        .source-menu-divider {
          height: 1px;
          background: #eee;
          margin: 4px 0;
        }

        .source-summary {
          color: #666;
          font-size: 13px;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .source-selector {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .source-menu {
            width: 300px;
            min-width: 300px;
            max-width: 300px;
          }
          
          .option-name {
            max-width: 180px;
          }
        }
      `}</style>
    </div>
  );
}

export default SourceSelector;