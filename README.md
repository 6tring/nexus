# Nexus

A full-stack data mapping management tool for enterprise data implementations, with database-level audit logging, soft deletes, session attribution, and batch-level CSV import rollback.

## Overview

Nexus addresses a recurring problem in financial systems implementation work: translating data from source systems into the structured codes required by a target platform. In OneStream implementations and similar enterprise consolidation work, this translation layer often involves thousands of mappings across multiple domains (accounts, entities, products, departments, locations), with values that change over time and need to be maintained, audited, and rolled back as source systems evolve.

Spreadsheets are the common starting point for this work but become unmanageable at scale, and they don't preserve the history that auditors and implementation teams actually need. Nexus provides a purpose-built interface for managing these mappings with the operational guarantees that real implementation work requires: every change is captured at the database level, every CSV import is reversible as a unit, and deletions are recoverable by default.

## Features

- Inline cell editing with domain-specific target code validation
- Domain filtering across account, entity, product, department, and location
- Search across source and target values
- Bulk update operations on selected records
- CSV import and export with batch tracking and full batch rollback
- Database-level audit logging on every change with rollback capability
- Soft deletes with restore
- Session-based change attribution without requiring authentication
- Built-in interactive study guide with architecture walkthrough and code samples

## Architecture

The application uses a standard three-tier structure with the operational complexity concentrated on the server and database side, where it belongs for an enterprise data tool.

### Database-level audit logging

Every change to the `mappings` table is captured by a PostgreSQL trigger that writes to an `audit_log` table with the old values, new values, changed fields, action type (INSERT, UPDATE, DELETE), and session context. The trigger runs at the database level rather than in the application, which means changes are captured even if made directly via SQL, and the audit guarantee is structural rather than dependent on application discipline.

The session context (session ID, IP address, optional change reason) is set via `set_config` calls in middleware before each query, allowing the trigger to attribute changes to the correct session without requiring authentication or user accounts.

### Session middleware

The session middleware generates a unique session ID, stores it in an httpOnly cookie, and exposes a `setDbSessionContext` helper that sets PostgreSQL session-level variables for the audit trigger to read. This pattern decouples session tracking from any specific authentication scheme and lets the audit log work in the same way whether the app is single-user, multi-user, or behind SSO.

### Soft deletes with restore

Records are not removed by default. Deletion sets a `deleted_at` timestamp, and all queries filter out soft-deleted records via `WHERE deleted_at IS NULL`. A separate restore endpoint clears the timestamp. A permanent delete option is available with an explicit query parameter, but the default path preserves data and history.

### CSV import as transactional batches

Each CSV import creates an `import_batches` record that tracks the filename, session, and counts (created, updated, skipped). Every mapping created by the import is linked to its batch through a join table, which makes the entire batch reversible as a single operation. This matters in implementation work because CSV imports are where the largest changes happen and where rollback is most likely to be needed.

### Domain-specific validation

Target codes follow strict format patterns by domain (`ACC###`, `ENT###`, `PROD###`, `DEPT###`, `LOC###`). Validation runs both client-side for immediate feedback and server-side as the authoritative check.

### Frontend state architecture

The React client centralizes state and logic in a single custom hook (`useDataManagement`) that handles data, filters, selection, editing state, and validation. This keeps the component tree clean and concentrates the application's coordination logic in one auditable location.

## Tech Stack

- **Frontend**: React 18, React Router, Vite, custom hooks for state management
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with triggers, functions, and views
- **CSV processing**: Multer for uploads, csv-parse and csv-stringify for streaming
- **Tooling**: Concurrently, ESLint

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Installation

Clone the repository and install all dependencies:

```bash
git clone [repository-url]
cd nexus
npm run install:all
```

Set up the PostgreSQL database and run the schema:

```bash
createdb data_mapping_manager_app_db
psql -d data_mapping_manager_app_db -f server/database/database.sql
```

The schema script creates all tables, the audit trigger function, supporting functions, and views.

Configure environment variables by copying `.env.example` to `.env` and updating:

- `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `SERVER_PORT` (defaults to 3000)
- `CLIENT_PORT` (defaults to 5173)

## Development

```bash
npm run dev
```

- Frontend (React + Vite): http://localhost:5173
- Backend API (Express): http://localhost:3000

The application includes a built-in study guide accessible from the frontend that walks through the architecture, key patterns, and code samples in detail.

## API Endpoints

### Mappings

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/mappings` | List all active mappings (filterable) |
| POST | `/api/mappings` | Create a new mapping |
| PUT | `/api/mappings/:id` | Update a mapping |
| PUT | `/api/mappings/bulk` | Bulk update selected mappings |
| DELETE | `/api/mappings/:id` | Soft delete (or permanent with `?permanent=true`) |
| POST | `/api/mappings/:id/restore` | Restore a soft-deleted mapping |
| GET | `/api/mappings/:id/history` | Audit history for a specific mapping |

### Import / Export

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/import` | Upload CSV file (multipart/form-data) |
| GET | `/api/export` | Download mappings as CSV |
| GET | `/api/import/history` | List all import batches |
| DELETE | `/api/import/batch/:id` | Roll back an entire import batch |

### Audit

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/audit/logs` | Query audit log with filters |
| GET | `/api/audit/statistics` | Aggregate stats by action, table, and session |
| POST | `/api/audit/rollback/:auditId` | Roll back a specific change |

### Query Parameters for GET /api/mappings

- `domain` — filter by domain (account, entity, product, department, location)
- `search` — search across source and target fields
- `status` — filter by status (active, inactive)
- `page` — page number (default: 1)
- `limit` — items per page (default: 100)

## Project Structure

```
nexus/
├── client/
│   └── src/
│       ├── components/      # MappingTable, TableControls, ImportExport, MappingHistory
│       ├── hooks/
│       │   └── useDataManagement.js   # Centralized state and logic
│       ├── utils/           # API helpers and client-side validation
│       └── pages/
│           └── GuidePage.jsx          # In-app study guide
├── server/
│   ├── server.js
│   ├── database/
│   │   └── database.sql               # Full schema with audit trigger
│   ├── routes/                        # mappings, import, sources, targets, audit, docs
│   ├── controllers/                   # CRUD logic, CSV processing, audit queries, rollback
│   ├── middleware/
│   │   └── sessionMiddleware.js       # Session ID + PostgreSQL session variables
│   └── utils/                         # Server-side validation
└── package.json
```

## Built-in Study Guide

The frontend includes a comprehensive guide page that documents the architecture, audit trigger pattern, session middleware, soft delete strategy, CSV batch import flow, and the custom React hook structure with annotated code samples. The guide was built as a learning resource alongside the app itself and serves as deeper documentation for anyone running the project locally.

## License

MIT