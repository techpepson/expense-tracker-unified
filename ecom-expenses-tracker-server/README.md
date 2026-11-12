# e-Com Services Expense Tracker

Internal app for recording company expenses and producing monthly reports.
Stack: FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, React (frontend comes next).

## Backend setup

Needs Python 3.10 or newer (tested on 3.12) and a local PostgreSQL server.

### 1. Create the databases

Open `psql` as the postgres superuser and run:

```sql
CREATE USER ecom WITH PASSWORD 'your_password';
CREATE DATABASE ecom_expenses OWNER ecom;
CREATE DATABASE ecom_expenses_test OWNER ecom;
```

The second database is for the automated tests. Making `ecom` the owner avoids
"permission denied for schema public" errors on PostgreSQL 15 and newer.

### 2. Install and configure

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1
# Windows cmd:  .venv\Scripts\activate.bat      macOS/Linux:  source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

Edit `.env`: set `DATABASE_URL` and a real `SECRET_KEY`.

### 3. Create the tables and starter data

```bash
alembic upgrade head      # builds the tables
python -m app.seed        # first admin account + 10 starter categories
```

### 4. Run

```bash
uvicorn app.main:app --reload
```

- Interactive docs: http://127.0.0.1:8000/docs (use the Authorize button, put the email in `username`)
- Health check: http://127.0.0.1:8000/api/health (confirms the database connection)

### 5. Test

```bash
pytest -q
```

Tests run against `ecom_expenses_test` (your `DATABASE_URL` name plus `_test`) and wipe it
between tests. They refuse to run against any database whose name does not end in `_test`.

## Changing the database later

1. Edit a model in `app/models/`.
2. `alembic revision --autogenerate -m "describe the change"`
3. Open the new file in `alembic/versions/` and read it.
4. `alembic upgrade head`, then commit the migration file.

Your teammate runs `alembic upgrade head` after pulling.

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| POST | /api/auth/login | anyone (form fields `username`, `password`) |
| GET | /api/auth/me | logged in |
| POST | /api/auth/change-password | logged in |
| GET | /api/expenses | logged in (filters: year, month, category_id, expense_type, created_by, q, sort_by, order, page, page_size) |
| POST | /api/expenses | logged in (shared type needs permission) |
| GET | /api/expenses/{id} | logged in |
| PATCH | /api/expenses/{id} | owner or admin |
| DELETE | /api/expenses/{id} | owner or admin |
| GET | /api/categories | logged in (`include_inactive` for admins) |
| POST, PATCH | /api/categories, /api/categories/{id} | admin |
| GET, POST, PATCH | /api/users, /api/users/{id} | admin |
| GET | /api/reports/monthly?year=&month= | logged in |
| GET | /api/reports/monthly/export/pdf?year=&month= | logged in |
| GET | /api/reports/monthly/export/excel?year=&month= | logged in |
| GET | /api/health | anyone |

## Decisions and assumptions

Confirmed with the team:

- Everyone can see all expenses (OD-01).
- Employees can edit and delete their own expenses, admins can edit and delete any (OD-06).
- No separate "incurred by" field in the MVP; the creator is recorded (OD-05).

Assumed until e-Com confirms (each is a small change):

- Reports cover the calendar month. The rule lives in `app/services/periods.py` (OD-02).
- Currency is GHS everywhere (OD-03). Set by `CURRENCY` in `.env`.
- "Designated expense recorder" is a flag on the user (`can_record_shared`). Admins always have it (OD-04).
- Accounts are created by an admin. There is no self-registration (OD-08).
- Deleting an expense removes the row. There is no change history yet (see OD-06, section 21.2 of the spec).
- Expense dates in the future are rejected.
