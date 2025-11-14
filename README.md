# Data Mapping Manager

A simplified data mapping management tool for mapping source values to target codes across different domains.

## Features

- View and edit data mappings in a table interface
- Filter by domain (account, entity, product, department, location)
- Search source/target values
- Bulk update selected mappings
- Import/Export CSV files

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Installation

1. Clone the repository
git clone [repository-url]
cd data-mapping-manager-lite

2. Install all dependencies
npm run install:all

3. Set up PostgreSQL database
createdb mapping_manager_lite

4. Configure environment variables
   - Copy `.env.example` to `.env` (or manually create `.env`)
   - Update database credentials in `.env`:
     - `DB_USER` - Your PostgreSQL username
     - `DB_PASSWORD` - Your PostgreSQL password
     - `DB_NAME` - Keep as `mapping_manager_lite`

5. Run database setup
npm run setup:db

## Development

Start both frontend and backend servers:
npm run dev

This will run:
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
- `domain` - Filter by domain (account, entity, product, department, location)
- `search` - Search in source/target fields
- `status` - Filter by status (active, inactive)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 100)

## Project Structure

├── client/          # React frontend
├── server/          # Express backend
├── uploads/         # Temporary file uploads
└── package.json     # Root package with concurrently

## Database Setup
Run the following to set up the database:
`psql -U your_user -d your_db_name -f server/database/database.sql`

## Tech Stack

- **Frontend**: React, Vite, CSS Modules
- **Backend**: Node.js, Express, PostgreSQL
- **Database**: PostgreSQL with pg driver
- **Dev Tools**: Concurrently, ESLint

## License

MIT