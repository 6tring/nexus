# Nexus

A data mapping management tool for mapping source values to target codes across configurable domains.

## Features

- View and edit data mappings in a table interface
- Filter by domain (account, entity, product, department, location)
- Search source and target values
- Bulk update selected mappings
- Import/Export CSV files
- Built-in study guide with architecture walkthrough

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd nexus
   ```

2. Install all dependencies:
   ```bash
   npm run install:all
   ```

3. Set up PostgreSQL database:
   ```bash
   createdb mapping_manager_lite
   ```

4. Configure environment variables — copy `.env.example` to `.env` and update:
   - `DB_USER` — your PostgreSQL username
   - `DB_PASSWORD` — your PostgreSQL password
   - `DB_NAME` — keep as `mapping_manager_lite`

5. Run database setup:
   ```bash
   npm run setup:db
   ```

## Development

```bash
npm run dev
```

- Frontend (React + Vite): http://localhost:5173
- Backend API (Express): http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mappings` | Get all mappings with optional filters |
| PUT | `/api/mappings/:id` | Update a single mapping |
| PUT | `/api/mappings/bulk` | Bulk update multiple mappings |
| POST | `/api/import` | Import CSV file |
| GET | `/api/export` | Export mappings as CSV |
| GET | `/api/targets` | Get target values for dropdown |

### Query Parameters for GET /api/mappings
- `domain` — filter by domain (account, entity, product, department, location)
- `search` — search in source/target fields
- `status` — filter by status (active, inactive)
- `page` — page number (default: 1)
- `limit` — items per page (default: 100)

## Tech Stack

- **Frontend**: React, React Router, Vite
- **Backend**: Node.js, Express, PostgreSQL
- **Database**: PostgreSQL with pg driver
- **Dev Tools**: Concurrently, ESLint

## License

MIT
