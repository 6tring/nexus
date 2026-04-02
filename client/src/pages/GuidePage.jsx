import React, { useState, useEffect } from 'react';
import CodeBlock from '../components/CodeBlock.jsx';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'learning-path', label: 'Learning Path' },
  { id: 'key-concepts', label: 'Key Concepts' },
  { id: 'api-reference', label: 'API Reference' },
  { id: 'features', label: 'Features' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

const GuidePage = () => {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const handleScroll = () => {
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(sections[i].id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="guide-layout">
      <nav className="guide-sidebar">
        <div className="guide-sidebar-title">Study Guide</div>
        {sections.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className={`guide-sidebar-link ${activeSection === id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection(id);
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      <main className="guide-content">
        {/* OVERVIEW */}
        <section id="overview">
          <h1>Data Mapping Manager</h1>
          <p className="guide-subtitle">
            A full-stack data management application with audit trails, CSV import/export,
            soft deletes, and session tracking using Express and PostgreSQL.
          </p>
          <p>
            This application demonstrates enterprise-grade data management patterns. It maps
            source identifiers to standardized target codes across multiple business domains
            (accounts, entities, products, departments, locations). Every change is tracked
            in an audit log with full rollback capability.
          </p>
          <div className="guide-info-box">
            <strong>What makes this app unique:</strong> This is the most feature-rich CRUD app
            in the portal. It teaches soft deletes, PostgreSQL triggers for audit logging,
            session-based tracking, CSV import/export with batch management, and source
            merging — patterns commonly found in enterprise data systems.
          </div>
          <h3>Technologies Used</h3>
          <ul>
            <li><strong>React 18</strong> — Frontend with custom hook for state management</li>
            <li><strong>Express 4</strong> — Backend REST API</li>
            <li><strong>PostgreSQL</strong> — Database with triggers, functions, and views</li>
            <li><strong>Multer</strong> — CSV file upload handling</li>
            <li><strong>csv-parse / csv-stringify</strong> — CSV processing</li>
          </ul>
        </section>

        {/* GETTING STARTED */}
        <section id="getting-started">
          <h2>Getting Started</h2>
          <h3>Prerequisites</h3>
          <ul>
            <li>Node.js 18 or higher</li>
            <li>PostgreSQL running locally (default port 5432)</li>
          </ul>
          <h3>Database Setup</h3>
          <CodeBlock
            title="Terminal"
            code={`# Create the database
createdb data_mapping_manager_app_db

# Run the schema (creates tables, triggers, functions, views)
psql -d data_mapping_manager_app_db -f server/database/database.sql`}
          />
          <h3>Installation</h3>
          <CodeBlock
            title="Terminal"
            code={`# Install all dependencies (root + client + server)
npm run install:all

# Or install individually
cd server && npm install
cd ../client && npm install`}
          />
          <h3>Environment Setup</h3>
          <p>The <code>.env</code> file at the project root:</p>
          <CodeBlock
            title=".env"
            code={`DB_HOST=localhost
DB_PORT=5432
DB_NAME=data_mapping_manager_app_db
DB_USER=postgres
DB_PASSWORD=data
SERVER_PORT=3000
CLIENT_PORT=5173
NODE_ENV=development
CLIENT_ID=default`}
          />
          <div className="guide-warning-box">
            <strong>Note:</strong> This app uses <code>SERVER_PORT</code> instead of the
            standard <code>PORT</code>. This is a deliberate design choice to avoid ambiguity
            when both client and server ports are configured in the same .env file.
          </div>
          <h3>Running the App</h3>
          <CodeBlock
            title="Terminal"
            code={`# From the project root — starts both client and server
npm run dev`}
          />
        </section>

        {/* ARCHITECTURE */}
        <section id="architecture">
          <h2>Architecture Overview</h2>
          <p>
            The app follows a standard client/server split with a particularly rich server-side
            architecture. The database schema includes triggers that automatically create audit
            log entries on every data change.
          </p>
          <div className="file-tree">{`data-mapping-manager-app/
├── .env                              # Shared config (SERVER_PORT, DB_*)
├── client/
│   ├── src/
│   │   ├── App.jsx                   # Main app component
│   │   ├── components/
│   │   │   ├── MappingTable.jsx      # Editable data table
│   │   │   ├── TableControls.jsx     # Filters, search, bulk update
│   │   │   ├── ImportExport.jsx      # CSV import/export buttons
│   │   │   ├── SourceSelector.jsx    # Data source dropdown
│   │   │   ├── MappingHistory.jsx    # Audit trail modal
│   │   │   └── CodeBlock.jsx         # Code snippet display
│   │   ├── hooks/
│   │   │   └── useDataManagement.js  # Central state hook
│   │   ├── utils/
│   │   │   ├── api.js                # All API calls
│   │   │   └── validation.js         # Client-side validation
│   │   └── pages/
│   │       └── GuidePage.jsx         # This study guide
│   └── vite.config.js
└── server/
    ├── server.js                     # Entry: pool, middleware, routes
    ├── database/
    │   └── database.sql              # Full schema with triggers
    ├── routes/
    │   ├── mappings.js               # CRUD + bulk + history
    │   ├── import.js                 # CSV import/export
    │   ├── sources.js                # Source management
    │   ├── targets.js                # Target reference data
    │   ├── audit.js                  # Audit log queries
    │   └── docs.js                   # API documentation
    ├── controllers/
    │   ├── mappingController.js      # Mapping CRUD logic
    │   ├── importController.js       # CSV processing
    │   ├── sourceController.js       # Source merge/delete
    │   ├── targetController.js       # Target lookup
    │   └── auditController.js        # Audit queries + rollback
    ├── middleware/
    │   └── sessionMiddleware.js      # Session ID + tracking
    └── utils/
        └── validation.js             # Server-side validation`}</div>
          <h3>Data Flow</h3>
          <ol>
            <li>User edits a cell or imports a CSV in the React frontend</li>
            <li>API call goes through Vite proxy to Express</li>
            <li>Session middleware attaches session ID and IP address</li>
            <li>Controller validates input and executes PostgreSQL query</li>
            <li>PostgreSQL trigger automatically creates an audit log entry</li>
            <li>Response returns updated data to the client</li>
          </ol>
        </section>

        {/* LEARNING PATH */}
        <section id="learning-path">
          <h2>Recommended Learning Path</h2>
          <div className="learning-step">
            <div className="learning-step-number">1</div>
            <div className="learning-step-content">
              <h4>Database Schema</h4>
              <p>
                Start with <code>server/database/database.sql</code>. Understand the tables
                (mappings, audit_log, import_batches, targets), the audit trigger, PostgreSQL
                functions, and views.
              </p>
            </div>
          </div>
          <div className="learning-step">
            <div className="learning-step-number">2</div>
            <div className="learning-step-content">
              <h4>Session Middleware</h4>
              <p>
                Read <code>server/middleware/sessionMiddleware.js</code> to see how sessions are
                generated, stored in cookies, and used to set PostgreSQL session variables for
                audit tracking.
              </p>
            </div>
          </div>
          <div className="learning-step">
            <div className="learning-step-number">3</div>
            <div className="learning-step-content">
              <h4>Mapping CRUD Controller</h4>
              <p>
                Study <code>server/controllers/mappingController.js</code> for the complete CRUD
                pattern with soft deletes, duplicate checking, and bulk updates.
              </p>
            </div>
          </div>
          <div className="learning-step">
            <div className="learning-step-number">4</div>
            <div className="learning-step-content">
              <h4>CSV Import/Export</h4>
              <p>
                Read <code>server/controllers/importController.js</code> to see file upload
                handling with Multer, CSV parsing, batch creation, and rollback.
              </p>
            </div>
          </div>
          <div className="learning-step">
            <div className="learning-step-number">5</div>
            <div className="learning-step-content">
              <h4>Custom React Hook</h4>
              <p>
                Study <code>client/src/hooks/useDataManagement.js</code> — a large custom hook
                that manages all application state, API calls, filtering, and validation.
              </p>
            </div>
          </div>
          <div className="learning-step">
            <div className="learning-step-number">6</div>
            <div className="learning-step-content">
              <h4>Inline Editing &amp; Validation</h4>
              <p>
                Walk through <code>MappingTable.jsx</code> and <code>validation.js</code> to see
                how cell-level editing works with domain-specific target format validation.
              </p>
            </div>
          </div>
        </section>

        {/* KEY CONCEPTS */}
        <section id="key-concepts">
          <h2>Key Concepts Deep Dive</h2>

          <h3>PostgreSQL Audit Triggers</h3>
          <p>
            The database uses a trigger on the <code>mappings</code> table that automatically
            captures every INSERT, UPDATE, and DELETE operation. The trigger function reads
            session context variables set by the middleware.
          </p>
          <CodeBlock
            title="database.sql — Audit trigger (simplified)"
            code={`CREATE OR REPLACE FUNCTION audit_mapping_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, record_id, action,
    old_values, new_values, changed_fields,
    session_id, ip_address, change_reason
  ) VALUES (
    'mappings',
    COALESCE(NEW.id, OLD.id),
    TG_OP,                              -- INSERT, UPDATE, or DELETE
    CASE WHEN TG_OP != 'INSERT'
      THEN row_to_json(OLD) END,        -- Old values (UPDATE/DELETE)
    CASE WHEN TG_OP != 'DELETE'
      THEN row_to_json(NEW) END,        -- New values (INSERT/UPDATE)
    -- changed_fields array...
    current_setting('app.session_id', true),
    current_setting('app.ip_address', true),
    current_setting('app.change_reason', true)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mappings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON mappings
  FOR EACH ROW EXECUTE FUNCTION audit_mapping_changes();`}
          />

          <h3>Session Middleware</h3>
          <p>
            The session middleware generates a unique session ID, stores it in an httpOnly cookie,
            and sets PostgreSQL session-level variables so the audit trigger can capture who made
            each change.
          </p>
          <CodeBlock
            title="server/middleware/sessionMiddleware.js — Key pattern"
            code={`// Set PostgreSQL session variables for audit tracking
req.setDbSessionContext = async (pool) => {
  const client = await pool.connect();
  try {
    await client.query(
      "SELECT set_config('app.session_id', $1, false)",
      [req.sessionId]
    );
    await client.query(
      "SELECT set_config('app.ip_address', $1, false)",
      [req.clientIp]
    );
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
};`}
          />

          <h3>Soft Deletes</h3>
          <p>
            Instead of permanently removing records, the app sets a <code>deleted_at</code>
            timestamp. All queries filter out soft-deleted records by default. Records can be
            restored by clearing the timestamp.
          </p>
          <CodeBlock
            title="server/controllers/mappingController.js — Soft delete"
            code={`// Soft delete (default)
const softDelete = async (req, res) => {
  const result = await pool.query(
    'UPDATE mappings SET deleted_at = NOW() WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  // ...
};

// Permanent delete (only with ?permanent=true)
const permanentDelete = async (req, res) => {
  await pool.query('DELETE FROM mappings WHERE id = $1', [req.params.id]);
};

// All queries exclude soft-deleted records
const getMappings = async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM mappings WHERE deleted_at IS NULL'
  );
};`}
          />

          <h3>CSV Import with Batch Tracking</h3>
          <p>
            CSV imports create an <code>import_batches</code> record that tracks the filename,
            upload timestamp, and counts (created, updated, skipped). Each mapping created by
            an import is linked to its batch, enabling full batch rollback.
          </p>
          <CodeBlock
            title="server/controllers/importController.js — Batch import"
            code={`// Create import batch record
const batchResult = await pool.query(
  \`INSERT INTO import_batches
   (filename, uploaded_by, session_id, total_rows)
   VALUES ($1, $2, $3, $4) RETURNING id\`,
  [file.originalname, req.sessionId, req.sessionId, records.length]
);
const batchId = batchResult.rows[0].id;

// Process each CSV row
for (const record of records) {
  // Validate, check duplicates, insert/update
  // Link to batch via import_batch_mappings
}

// Update batch with final counts
await pool.query(
  \`UPDATE import_batches
   SET created_count = $1, updated_count = $2,
       skipped_count = $3, status = 'completed'
   WHERE id = $4\`,
  [created, updated, skipped, batchId]
);`}
          />

          <h3>Domain-Specific Validation</h3>
          <p>
            Target codes follow strict patterns based on the business domain. Both client-side
            and server-side validation enforce these formats.
          </p>
          <CodeBlock
            title="Validation patterns"
            code={`// Target code formats by domain
const TARGET_PATTERNS = {
  account:    /^ACC\\d{3}$/,    // ACC001, ACC999
  entity:     /^ENT\\d{3}$/,    // ENT001, ENT999
  product:    /^PROD\\d{3}$/,   // PROD001, PROD999
  department: /^DEPT\\d{3}$/,   // DEPT001, DEPT999
  location:   /^LOC\\d{3}$/,    // LOC001, LOC999
};`}
          />

          <h3>Custom React Hook — useDataManagement</h3>
          <p>
            The <code>useDataManagement</code> hook centralizes all application state and logic.
            This pattern keeps the App component clean while managing complex interactions
            between filtering, CRUD operations, and source selection.
          </p>
          <CodeBlock
            title="client/src/hooks/useDataManagement.js — Structure"
            code={`export function useDataManagement() {
  // Data state
  const [mappings, setMappings] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');

  // Filter state
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // UI state
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Derived data
  const filteredMappings = useMemo(() => {
    return mappings
      .filter(m => selectedDomain === 'all' || m.domain === selectedDomain)
      .filter(m => m.source.toLowerCase().includes(searchTerm));
  }, [mappings, selectedDomain, searchTerm]);

  // Return everything the App component needs
  return { filteredMappings, sources, /* ...all state and handlers */ };
}`}
          />
        </section>

        {/* API REFERENCE */}
        <section id="api-reference">
          <h2>API Reference</h2>
          <h3>Mappings</h3>
          <table className="api-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="method-badge method-get">GET</span></td>
                <td><code>/api/mappings</code></td>
                <td>List all active mappings (filterable)</td>
              </tr>
              <tr>
                <td><span className="method-badge method-post">POST</span></td>
                <td><code>/api/mappings</code></td>
                <td>Create a new mapping</td>
              </tr>
              <tr>
                <td><span className="method-badge method-put">PUT</span></td>
                <td><code>/api/mappings/:id</code></td>
                <td>Update a mapping</td>
              </tr>
              <tr>
                <td><span className="method-badge method-put">PUT</span></td>
                <td><code>/api/mappings/bulk</code></td>
                <td>Bulk update selected mappings</td>
              </tr>
              <tr>
                <td><span className="method-badge method-delete">DELETE</span></td>
                <td><code>/api/mappings/:id</code></td>
                <td>Soft delete (or permanent with ?permanent=true)</td>
              </tr>
              <tr>
                <td><span className="method-badge method-post">POST</span></td>
                <td><code>/api/mappings/:id/restore</code></td>
                <td>Restore a soft-deleted mapping</td>
              </tr>
              <tr>
                <td><span className="method-badge method-get">GET</span></td>
                <td><code>/api/mappings/:id/history</code></td>
                <td>Audit history for a specific mapping</td>
              </tr>
            </tbody>
          </table>
          <h3>Import / Export</h3>
          <table className="api-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="method-badge method-post">POST</span></td>
                <td><code>/api/import</code></td>
                <td>Upload CSV file (multipart/form-data)</td>
              </tr>
              <tr>
                <td><span className="method-badge method-get">GET</span></td>
                <td><code>/api/export</code></td>
                <td>Download mappings as CSV</td>
              </tr>
              <tr>
                <td><span className="method-badge method-get">GET</span></td>
                <td><code>/api/import/history</code></td>
                <td>List all import batches</td>
              </tr>
              <tr>
                <td><span className="method-badge method-delete">DELETE</span></td>
                <td><code>/api/import/batch/:id</code></td>
                <td>Rollback an entire import batch</td>
              </tr>
            </tbody>
          </table>
          <h3>Audit</h3>
          <table className="api-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="method-badge method-get">GET</span></td>
                <td><code>/api/audit/logs</code></td>
                <td>Query audit log with filters</td>
              </tr>
              <tr>
                <td><span className="method-badge method-get">GET</span></td>
                <td><code>/api/audit/statistics</code></td>
                <td>Aggregate stats by action/table/session</td>
              </tr>
              <tr>
                <td><span className="method-badge method-post">POST</span></td>
                <td><code>/api/audit/rollback/:auditId</code></td>
                <td>Rollback a specific change</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* FEATURES */}
        <section id="features">
          <h2>How to Use / Features</h2>
          <h3>Things to Try</h3>
          <ol>
            <li>
              <strong>Edit a cell</strong> — Click any source or target cell in the table to
              edit it inline. Target codes must match the domain format (e.g., ACC001 for accounts).
            </li>
            <li>
              <strong>Bulk update</strong> — Select multiple rows using checkboxes, then enter
              a new target code in the bulk update bar.
            </li>
            <li>
              <strong>Import a CSV</strong> — Click "Import" and upload a CSV with columns:
              source, target, domain. The app handles duplicates automatically.
            </li>
            <li>
              <strong>Export data</strong> — Click "Export" to download all active mappings as CSV.
            </li>
            <li>
              <strong>View history</strong> — Click the history icon on any mapping to see its
              full audit trail with before/after values and rollback buttons.
            </li>
            <li>
              <strong>Switch data sources</strong> — Use the source selector dropdown to view
              mappings from different import sources.
            </li>
            <li>
              <strong>Filter by domain</strong> — Use the domain dropdown to show only account,
              entity, product, department, or location mappings.
            </li>
          </ol>
          <h3>Patterns to Study</h3>
          <ul>
            <li>
              <strong>Audit triggers vs application logging:</strong> This app logs at the
              database level using PostgreSQL triggers, ensuring every change is captured even
              if made directly via SQL. Compare this to application-level logging.
            </li>
            <li>
              <strong>Soft deletes vs hard deletes:</strong> Soft deletes preserve data integrity
              and allow recovery, but require filtering <code>WHERE deleted_at IS NULL</code>
              on every query. Study the trade-offs.
            </li>
            <li>
              <strong>Session tracking without auth:</strong> This app tracks sessions via
              cookies without requiring login. Each session gets a unique ID used for audit
              attribution.
            </li>
          </ul>
        </section>

        {/* TROUBLESHOOTING */}
        <section id="troubleshooting">
          <h2>Troubleshooting</h2>
          <h3>Database Not Found</h3>
          <p>
            The app requires a PostgreSQL database. Create it and run the schema:
          </p>
          <CodeBlock
            title="Fix"
            code={`createdb data_mapping_manager_app_db
psql -d data_mapping_manager_app_db -f server/database/database.sql`}
          />
          <h3>SERVER_PORT vs PORT</h3>
          <p>
            This app uses <code>SERVER_PORT</code>, not <code>PORT</code>. If the server
            doesn't start, check that the .env file has <code>SERVER_PORT=3000</code> (or
            the portal-specific port).
          </p>
          <h3>CSV Import Fails</h3>
          <p>
            The CSV file must have headers: <code>source</code>, <code>target</code>,
            <code>domain</code>. Target values must match domain patterns (ACC###, ENT###, etc.).
            Check the server logs for specific validation errors.
          </p>
          <h3>No Data Showing</h3>
          <p>
            If the table is empty after setup, use the "Import" feature to load sample data, or
            create mappings manually. Check the source selector — it may be filtering to a
            specific import source.
          </p>
          <div className="guide-warning-box">
            <strong>Caution:</strong> The "Clear Sample Data" button in the source selector
            deletes ALL mappings from the database. This action is irreversible.
          </div>
        </section>
      </main>
    </div>
  );
};

export default GuidePage;
