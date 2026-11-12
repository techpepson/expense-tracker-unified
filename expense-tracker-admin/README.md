# e-COM Expense Tracker — Administrator Web App

Standalone **Administrator** portal for **e-COM Services**, replacing the hand-typed Excel workbook (`docs/expenditure.xlsx`, *"Expenditure Tracker"*). Deployed on its own domain (`admin.expenses.ecom.com`), completely separate from the employee web application, and wired to the FastAPI backend at `ecom-expenses-tracker-server`.

## Scope & Architecture

- **Admin-only application**: Manages users, categories, the item catalog (including employee suggestions & duplicate merging), all expense records, petty cash ledger & opening balances, monthly/annual reports, Excel/PDF exports, dry-run `.xlsx` data imports, and organisation settings.
- **Zero shared frontend code with the employee app**: The two apps communicate exclusively via the shared REST API (`http://localhost:8000`).
- **Bearer-token authentication**: Uses `Authorization: Bearer <token>` and `X-Client-App: admin` headers (no cross-domain cookies). Non-administrator accounts receive `403 { code: "employee_account" }` and are directed to `VITE_EMPLOYEE_APP_URL`.
- **30-minute idle timeout**: Automatically warns after 30 minutes of inactivity and signs out after a 60-second countdown.
- **Exact money math**: All arithmetic is computed in integer pesewas (`1 GHS = 100 pesewas`) and formatted as `GH₵ 1,250.00` via `Intl.NumberFormat`.

## Setup & Running with the Backend Server

### 1. Start the FastAPI Backend (`ecom-expenses-tracker-server`)

```powershell
cd "C:\Development\Production Programs\Codes\servers\ecom-expenses-tracker-server"
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

### 2. Start the Admin Frontend (`expense-tracker-admin`)

```powershell
cd "C:\Development\Production Programs\Codes\expense-tracker-admin"
npm run dev
```

The admin portal runs at `http://localhost:5174` and connects directly to `http://localhost:8000` (`VITE_API_BASE_URL=http://localhost:8000`, `VITE_USE_MOCKS=false`).

### Demo Credentials

- **Administrator**: `admin@ecom.com` / `password123` (or `admin@example.com` / `ChangeMe123!`)
- **Employee (tests `403 employee_account` redirect notice)**: `employee@ecom.com` / `password123`

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the shared FastAPI REST API (no trailing slash). | `http://localhost:8000` |
| `VITE_USE_MOCKS` | `"false"` connects to the live FastAPI backend; `"true"` enables the in-browser MSW mock server. | `false` |
| `VITE_EMPLOYEE_APP_URL` | Public URL of the separate employee web app (linked when an employee attempts to sign in here). | `http://localhost:5173` |

## CORS Requirements (Separate Admin & Employee Domains)

Because the Administrator app (`http://localhost:5174` / `https://admin.expenses.ecom.com`) and the Employee app (`http://localhost:5173` / `https://expenses.ecom.com`) are hosted on separate origins and authenticate via Bearer tokens (`withCredentials: false`):

- **`Access-Control-Allow-Origin`**: Must explicitly allow both `https://admin.expenses.ecom.com` and `https://expenses.ecom.com` (plus `http://localhost:5174`, `http://127.0.0.1:5174`, `http://localhost:5173`, `http://127.0.0.1:5173` in development — configured via `CORS_ORIGINS` in the server's `.env`).
- **`Access-Control-Allow-Headers`**: `Authorization, Content-Type, Accept, X-Client-App`
- **`Access-Control-Allow-Methods`**: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **`Access-Control-Expose-Headers`**: `Content-Disposition`
