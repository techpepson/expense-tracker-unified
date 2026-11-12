# e-COM Expense Tracker — Backend API Server (`ecom-expenses-tracker-server`)

Shared REST API backend for the **e-COM Services Expense Tracker** platform. Built with **FastAPI**, **SQLAlchemy 2**, **Alembic**, and **PostgreSQL**, serving both the [Employee Client](../ecom-expense-tracker_client) and the [Administrator Portal](../expense-tracker-admin).

---

## ✨ Key Capabilities

- **JWT Bearer Authentication**: Stateless authentication with portal-aware role checks (`X-Client-App` header support to prevent admin/employee cross-portal sign-ins).
- **Role-Based Access Control (RBAC)**: Granular permissions for `admin`, designated expense recorders (`can_record_shared`), and standard `employee` accounts.
- **Expense & Petty Cash Ledger**: Full CRUD for individual and shared operational expenses, plus monthly petty cash opening balances and replenishment tracking.
- **Category & Item Catalog Management**: Category ordering, activation/deactivation, item catalog lookups, and duplicate item merging.
- **Reporting & Exports**: Monthly and annual expenditure aggregations with server-generated **PDF** (`ReportLab`) and **Excel** (`openpyxl`) downloads.
- **Spreadsheet Import Engine**: Dry-run validation and bulk import of legacy `.xlsx` expenditure workbooks.

---

## 🧰 Tech Stack

- **Framework**: FastAPI + Uvicorn
- **ORM & Migrations**: SQLAlchemy 2.0 + Alembic + Psycopg 3 (`psycopg[binary]`)
- **Database**: PostgreSQL 15+
- **Validation & Settings**: Pydantic v2 + `pydantic-settings`
- **Security**: PyJWT + `bcrypt`
- **Document Generation**: ReportLab + PyPDF (PDF) & OpenPyXL (Excel)
- **Testing**: Pytest + HTTPX

---

## 📂 Project Structure

```text
ecom-expenses-tracker-server/
├── alembic/                  # Database migration scripts and environment
├── app/
│   ├── core/                 # Config (.env settings), JWT security, and FastAPI dependencies
│   ├── models/               # SQLAlchemy 2 models (User, Expense, Category, Item, PettyCash, Settings)
│   ├── routers/              # API route handlers (auth, profile, users, categories, items, expenses, petty_cash, reports, admin)
│   ├── schemas/              # Pydantic request/response schemas
│   ├── services/             # Business logic, period rules, PDF/Excel builders, and xlsx importer
│   ├── database.py           # Engine and session factory
│   ├── main.py               # FastAPI app initialization, CORS, and router registration
│   └── seed.py               # Initial admin user and starter categories seed script
├── tests/                    # Automated test suite (runs against *_test database)
├── alembic.ini               # Alembic configuration
└── requirements.txt          # Python package dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- **Python** 3.10+ (tested on Python 3.12+)
- **PostgreSQL** 15+

### 1. Create the PostgreSQL Databases

Open `psql` as the `postgres` superuser and create the development and test databases:

```sql
CREATE USER ecom WITH PASSWORD 'your_password';
CREATE DATABASE ecom_expenses OWNER ecom;
CREATE DATABASE ecom_expenses_test OWNER ecom;
```

*(Note: Making `ecom` the database owner prevents `permission denied for schema public` errors on PostgreSQL 15+.)*

### 2. Create Virtual Environment & Install Dependencies

```powershell
cd ecom-expenses-tracker-server
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Windows CMD: .venv\Scripts\activate.bat | macOS/Linux: source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` to configure your `DATABASE_URL`, `SECRET_KEY`, and `CORS_ORIGINS`.

### 3. Run Migrations & Seed Starter Data

```powershell
alembic upgrade head      # Creates all database tables
python -m app.seed        # Seeds initial admin account + starter categories
```

### 4. Start the API Server

```powershell
uvicorn app.main:app --reload --port 8000
```

- **Swagger UI (Interactive Docs)**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`
- **Health Check**: `http://127.0.0.1:8000/api/health`

---

## 🧪 Running Tests

```powershell
pytest -q
```

Tests automatically connect to `ecom_expenses_test` (derived by appending `_test` to your configured `DATABASE_URL` database name) and reset state between tests. As a safety guard, the test runner refuses to execute against any database whose name does not end in `_test`.

---

## 🔄 Database Migrations (Alembic)

When modifying or adding SQLAlchemy models in `app/models/`:

1. Generate a migration revision:
   ```powershell
   alembic revision --autogenerate -m "describe the schema change"
   ```
2. Review the generated script in `alembic/versions/`.
3. Apply the migration:
   ```powershell
   alembic upgrade head
   ```

---

## 📡 API Endpoints Overview

All endpoints are prefixed with `/api`:

| Router / Group | Method & Path | Access | Description |
| :--- | :--- | :--- | :--- |
| **System** | `GET /api/health` | Public | Verifies API uptime and PostgreSQL connectivity |
| **Auth** | `POST /api/auth/login` | Public | Authenticates user and returns JWT bearer token |
| | `GET /api/auth/me` | Authenticated | Returns current user profile and permissions |
| | `POST /api/auth/change-password` | Authenticated | Updates current user's password |
| **Profile** | `GET, PATCH /api/profile` | Authenticated | View or update current user's profile details |
| **Expenses** | `GET /api/expenses` | Authenticated | Paginated expense list with filters (`year`, `month`, `category_id`, `expense_type`, `created_by`, `q`, `sort_by`, `order`) |
| | `POST /api/expenses` | Authenticated | Record an expense (`shared` type requires `can_record_shared` or `admin`) |
| | `GET /api/expenses/{id}` | Authenticated | Retrieve single expense record |
| | `PATCH, DELETE /api/expenses/{id}` | Owner or Admin | Update or delete an expense record |
| **Petty Cash** | `GET /api/petty-cash` | Authenticated | Retrieve petty cash summary and ledger entries |
| | `POST, PATCH, DELETE /api/petty-cash/...` | Recorder or Admin | Manage petty cash entries and opening balances |
| **Categories** | `GET /api/categories` | Authenticated | List categories (`include_inactive` available for admins) |
| | `POST, PATCH /api/categories...` | Admin | Create, update, reorder, or toggle categories |
| **Items** | `GET /api/items` | Authenticated | List catalog items |
| | `POST, PATCH /api/items...` | Authenticated / Admin | Suggest items, manage catalog, or merge duplicates |
| **Reports** | `GET /api/reports/monthly` | Authenticated | Monthly expenditure breakdown (`year`, `month`) |
| | `GET /api/reports/monthly/export/pdf` | Authenticated | Download monthly report as PDF |
| | `GET /api/reports/monthly/export/excel` | Authenticated | Download monthly report as `.xlsx` |
| **Users** | `GET, POST, PATCH /api/users...` | Admin | List, create, and update user accounts & permissions |
| **Admin** | `/api/admin/...` | Admin | Organisation settings, bulk `.xlsx` import, and administrative tools |

---

## 📋 Core Business Rules

- **Visibility**: All authenticated staff can view company expenses.
- **Ownership**: Employees can edit and delete only their own expenses; administrators can edit and delete any record.
- **Shared Operational Expenses**: Controlled by the `can_record_shared` flag on user accounts (always enabled for administrators).
- **Account Provisioning**: User accounts are provisioned by administrators; self-registration is disabled.
- **Date Validation**: Expense dates in the future are rejected.
- **Currency**: Defaults to `GHS` (configured via `CURRENCY` in `.env`).
