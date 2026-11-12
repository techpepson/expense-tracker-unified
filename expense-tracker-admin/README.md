# e-COM Expense Tracker — Administrator Portal (`expense-tracker-admin`)

Standalone **Administrator Web Application** for **e-COM Services**, replacing the manual Excel workbook (`docs/expenditure.xlsx`, *"Expenditure Tracker"*). Designed for deployment on its own origin (`admin.expenses.ecom.com`), separate from the [Employee Client](../ecom-expense-tracker_client), and powered by the [FastAPI Backend Server](../ecom-expenses-tracker-server).

---

## ✨ Key Features

- **Full Expense Oversight**: View, filter, create, edit, and delete any individual or shared company expense across all staff members.
- **User & Permission Management**: Provision employee and administrator accounts, toggle active status, reset passwords, and assign `can_record_shared` permissions.
- **Category & Item Catalogs**: Manage active/inactive expense categories, reorder categories via drag-and-drop (`@dnd-kit`), review employee-submitted item suggestions, and merge duplicate catalog items.
- **Petty Cash Administration**: Manage monthly opening balances, cash replenishments, and ledger entries.
- **Financial Reports & Exports**: Generate monthly breakdowns and annual expenditure matrices with one-click PDF and Excel exports.
- **Spreadsheet Import Wizard**: Upload `.xlsx` expenditure workbooks with dry-run validation and anomaly reporting before committing records.
- **Security & Idle Timeout**: Bearer-token authentication with `X-Client-App: admin` enforcement and an automatic 30-minute inactivity warning + 60-second sign-out countdown.
- **Exact Money Math**: All calculations are performed in integer pesewas (`1 GHS = 100 pesewas`) and formatted as `GH₵ 1,250.00`.

---

## 🧰 Tech Stack

- **Framework**: React 19 + TypeScript + Vite 8
- **UI & Styling**: Tailwind CSS v4 + Radix UI Primitives + Lucide Icons + `@dnd-kit`
- **State & Data Fetching**: Zustand + TanStack Query v5 + Axios
- **Tables & Visualizations**: TanStack Table v8 + Recharts 3
- **Forms & Validation**: React Hook Form + Zod
- **Exports & Precision Math**: Decimal.js, ExcelJS, jsPDF + AutoTable
- **Testing**: Vitest + React Testing Library + MSW

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- **npm** 9+

### 1. Start the FastAPI Backend (`ecom-expenses-tracker-server`)

From the unified repository root:

```powershell
cd ecom-expenses-tracker-server
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

### 2. Configure & Start the Admin Portal (`expense-tracker-admin`)

```powershell
cd expense-tracker-admin
copy .env.example .env
npm install
npm run dev
```

The administrator portal runs at `http://localhost:5174` and connects to `http://localhost:8000`.

---

## ⚙️ Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL of the shared FastAPI REST API (no trailing slash). | `http://localhost:8000` |
| `VITE_USE_MOCKS` | `"false"` connects to the live FastAPI backend; `"true"` enables the in-browser MSW mock server. | `false` |
| `VITE_EMPLOYEE_APP_URL` | Public URL of the employee web app (shown when an employee account attempts to sign in here). | `http://localhost:5173` |

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check (`tsc -b`) and build production bundle to `dist/` |
| `npm run typecheck` | Run TypeScript compiler checks without emitting files |
| `npm run lint` | Run ESLint across the project |
| `npm run format` | Format TypeScript and CSS files with Prettier |
| `npm test` | Run unit and integration tests once via Vitest |
| `npm run test:watch` | Run Vitest in interactive watch mode |
| `npm run import:xlsx` | Run the CLI spreadsheet parser (`scripts/import-xlsx.ts`) |
| `npm run preview` | Preview the built production bundle locally |

---

## 🌐 Application Routes

All routes except `/login` are protected by the `RequireAdmin` guard:

| Route | Description |
| :--- | :--- |
| `/login` | Administrator sign-in (redirects non-admins to `VITE_EMPLOYEE_APP_URL`) |
| `/dashboard` | Organisation-wide expenditure KPIs, charts, and recent activity |
| `/expenses` | Complete company expense log with advanced filtering and bulk actions |
| `/expenses/new` | Create new individual or shared operational expense records |
| `/expenses/:id` | Detailed expense inspection view |
| `/expenses/:id/edit` | Edit any expense record in the system |
| `/petty-cash` | Petty cash balance strip, opening balance management, and ledger |
| `/reports` | Monthly & annual expenditure reports with Excel and PDF exports |
| `/categories` | Category list with drag-and-drop ordering and active status toggles |
| `/categories/new` | Create a new expense category |
| `/categories/:id/edit` | Edit an existing expense category |
| `/items` | Item catalog management, employee suggestions, and duplicate merging |
| `/users` | Employee and admin directory with role & permission controls |
| `/users/new` | Provision a new user account |
| `/users/:id` / `/users/:id/edit` | View and update user details, role, and `can_record_shared` flag |
| `/import` | Interactive `.xlsx` workbook dry-run & import wizard |
| `/settings` | Organisation settings, currency configuration, and admin profile |

---

## 🔐 Demo Credentials

- **Administrator**: `admin@ecom.com` / `password123` (or `admin@example.com` / `ChangeMe123!`)
- **Employee (tests `403 employee_account` redirect notice)**: `employee@ecom.com` / `password123`

---

## 🛠 CORS Requirements

Because the Administrator Portal (`http://localhost:5174` / `https://admin.expenses.ecom.com`) and Employee App (`http://localhost:5173` / `https://expenses.ecom.com`) are hosted on separate origins and authenticate via Bearer tokens:

- **`Access-Control-Allow-Origin`**: Must include `http://localhost:5174` and `http://127.0.0.1:5174` in development (configured via `CORS_ORIGINS` in `ecom-expenses-tracker-server/.env`).
- **`Access-Control-Allow-Headers`**: `Authorization, Content-Type, Accept, X-Client-App`
- **`Access-Control-Allow-Methods`**: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- **`Access-Control-Expose-Headers`**: `Content-Disposition`
