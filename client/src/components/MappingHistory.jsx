import React, { useState, useEffect } from 'react';
import { getMappingHistory, rollbackChange } from '../utils/api';

function MappingHistory({ mappingId, mappingSource, onClose, onRollback }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [rollbackingId, setRollbackingId] = useState(null);

  useEffect(() => {
    if (mappingId) {
      loadHistory();
    }
  }, [mappingId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMappingHistory(mappingId);
      setHistory(data);
    } catch (err) {
      setError('Failed to load history');
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (auditId) => {
    if (!window.confirm('Are you sure you want to rollback to this version?')) {
      return;
    }

    setRollbackingId(auditId);
    try {
      await rollbackChange(auditId);
      // Reload history to show the rollback
      await loadHistory();
      if (onRollback) {
        onRollback();
      }
    } catch (err) {
      alert('Failed to rollback: ' + err.message);
    } finally {
      setRollbackingId(null);
    }
  };

  const toggleExpanded = (auditId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(auditId)) {
      newExpanded.delete(auditId);
    } else {
      newExpanded.add(auditId);
    }
    setExpandedItems(newExpanded);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFieldValue = (value) => {
    if (value === null || value === undefined) {
      return <span style={{ color: '#999' }}>(empty)</span>;
    }
    return value;
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'INSERT':
        return '➕';
      case 'UPDATE':
        return '✏️';
      case 'DELETE':
        return '🗑️';
      default:
        return '•';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'INSERT':
        return '#48bb78';
      case 'UPDATE':
        return '#ed8936';
      case 'DELETE':
        return '#e53e3e';
      default:
        return '#718096';
    }
  };

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2>Change History</h2>
          <div className="history-subtitle">
            Mapping: <strong>{mappingSource}</strong> (ID: {mappingId})
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="history-content">
          {loading && (
            <div className="history-loading">Loading history...</div>
          )}

          {error && (
            <div className="history-error">{error}</div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="history-empty">No history available</div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="history-list">
              {history.map((item) => {
                const isExpanded = expandedItems.has(item.audit_id);
                const changedFields = item.changed_fields || [];
                
                return (
                  <div key={item.audit_id} className="history-item">
                    <div className="history-item-header">
                      <div className="history-action">
                        <span 
                          className="action-icon" 
                          style={{ color: getActionColor(item.action) }}
                        >
                          {getActionIcon(item.action)}
                        </span>
                        <span className="action-label">{item.action}</span>
                      </div>
                      
                      <div className="history-meta">
                        <span className="history-date">
                          {formatDate(item.created_at)}
                        </span>
                        {item.session_id && (
                          <span className="history-session" title={`Session: ${item.session_id}`}>
                            👤
                          </span>
                        )}
                        {item.change_reason && (
                          <span className="history-reason" title={item.change_reason}>
                            💬
                          </span>
                        )}
                      </div>

                      <div className="history-actions">
                        {changedFields.length > 0 && (
                          <button
                            className="expand-btn"
                            onClick={() => toggleExpanded(item.audit_id)}
                          >
                            {isExpanded ? '▼' : '▶'} Details
                          </button>
                        )}
                        {item.action === 'UPDATE' && (
                          <button
                            className="rollback-btn"
                            onClick={() => handleRollback(item.audit_id)}
                            disabled={rollbackingId === item.audit_id}
                          >
                            {rollbackingId === item.audit_id ? 'Rolling back...' : 'Rollback'}
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="history-item-details">
                        {item.change_reason && (
                          <div className="change-reason">
                            <strong>Reason:</strong> {item.change_reason}
                          </div>
                        )}
                        
                        <div className="field-changes">
                          {changedFields.map((field) => (
                            <div key={field} className="field-change">
                              <div className="field-name">{field}:</div>
                              <div className="field-values">
                                {item.old_values && (
                                  <div className="old-value">
                                    <span className="value-label">Before:</span>
                                    {formatFieldValue(item.old_values[field])}
                                  </div>
                                )}
                                {item.new_values && (
                                  <div className="new-value">
                                    <span className="value-label">After:</span>
                                    {formatFieldValue(item.new_values[field])}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {item.ip_address && (
                          <div className="history-ip">
                            IP: {item.ip_address}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .history-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
        }

        .history-modal {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .history-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e2e8f0;
          position: relative;
        }

        .history-header h2 {
          margin: 0 0 0.5rem 0;
          color: #2c5282;
        }

        .history-subtitle {
          color: #718096;
          font-size: 0.9rem;
        }

        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 2rem;
          height: 2rem;
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #718096;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .close-btn:hover {
          background: #f7fafc;
          color: #2d3748;
        }

        .history-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .history-loading,
        .history-error,
        .history-empty {
          text-align: center;
          padding: 2rem;
          color: #718096;
        }

        .history-error {
          color: #e53e3e;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .history-item {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          overflow: hidden;
        }

        .history-item-header {
          padding: 1rem;
          background: #f8f9fa;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .history-action {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .action-icon {
          font-size: 1.2rem;
        }

        .action-label {
          color: #2d3748;
          font-size: 0.9rem;
          text-transform: uppercase;
        }

        .history-meta {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #718096;
          font-size: 0.85rem;
        }

        .history-session,
        .history-reason {
          cursor: help;
        }

        .history-actions {
          display: flex;
          gap: 0.5rem;
        }

        .expand-btn,
        .rollback-btn {
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .expand-btn {
          background: #edf2f7;
          color: #2d3748;
        }

        .expand-btn:hover {
          background: #e2e8f0;
        }

        .rollback-btn {
          background: #48bb78;
          color: white;
        }

        .rollback-btn:hover:not(:disabled) {
          background: #38a169;
        }

        .rollback-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .history-item-details {
          padding: 1rem;
          background: white;
          border-top: 1px solid #e2e8f0;
        }

        .change-reason {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: #f7fafc;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .field-changes {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .field-change {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
        }

        .field-name {
          font-weight: 600;
          color: #2d3748;
          min-width: 100px;
        }

        .field-values {
          flex: 1;
        }

        .old-value,
        .new-value {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .value-label {
          color: #718096;
          min-width: 60px;
        }

        .old-value {
          color: #e53e3e;
        }

        .new-value {
          color: #48bb78;
        }

        .history-ip {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid #e2e8f0;
          font-size: 0.85rem;
          color: #718096;
        }

        @media (max-width: 768px) {
          .history-modal {
            width: 95%;
            max-height: 90vh;
          }

          .history-item-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .history-meta {
            margin-top: 0.5rem;
          }

          .history-actions {
            margin-top: 0.5rem;
            width: 100%;
          }

          .expand-btn,
          .rollback-btn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default MappingHistory;