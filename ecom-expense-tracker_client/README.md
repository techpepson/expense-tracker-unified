# e-COM Expense Tracker — Employee Client (`ecom-expense-tracker_client`)

Internal employee web application for **e-COM Services**. Replaces the manual Excel sheet workflow (*"Expenditure Tracker"*) with real-time expenditure tracking, petty cash visibility, analytics dashboards, and PDF/Excel report exports.

---

## ✨ Key Features

- **Dashboard & Analytics**: Monthly expenditure overview, category breakdown donut chart, and multi-month trend visualizations powered by Recharts.
- **Expense Recording**: Standard single-entry form and Quick-Entry batch form for recording multiple receipts rapidly.
- **Petty Cash Tracking**: 5-point balance summary strip and transaction ledger. Designated expense recorders (`can_record_shared: true`) can record shared operational expenses and manage petty cash entries.
- **Reporting & Exports**: Monthly breakdown and annual expenditure matrix with client/server-side PDF (`jspdf`) and Excel (`exceljs`) exports.
- **Offline Mock Mode**: Built-in Mock Service Worker (`msw`) seeded from legacy spreadsheet data (`docs/expenditure.xlsx`) for standalone frontend testing and development.

---

## 🔒 Scope & Permissions

- **Employee-Only Portal**: Designed strictly for staff members. Administrators manage users, categories, and system settings in the separate [Administrator Portal](../expense-tracker-admin).
- **Admin Redirection**: If an administrator attempts to sign in (`403` with code `admin_account`), the login screen displays a notice directing them to `VITE_ADMIN_APP_URL`.
- **Designated Expense Recorder**: Staff with `can_record_shared: true` can log **Shared Operational** expenses and add/edit **Petty Cash** entries. Standard employees can log **Individual** expenses and have read-only visibility into Petty Cash.
- **Record Ownership**: Employees can edit and delete only the expense records they created.

---

## 🧰 Tech Stack

- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **State & Data Fetching**: Zustand + TanStack Query v5 + Axios
- **Tables & Charts**: TanStack Table v8 + Recharts 3
- **Forms & Validation**: React Hook Form + Zod
- **Exports & Precision Math**: Decimal.js, ExcelJS, SheetJS (`xlsx`), jsPDF + AutoTable
- **Testing**: Vitest + React Testing Library + MSW

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- **npm** 9+

### 1. Environment Variables
Copy `.env.example` to `.env`:

```powershell
copy .env.example .env
```

```env
# Base URL for the FastAPI backend (no trailing slash)
VITE_API_BASE_URL=http://localhost:8000

# Set to "true" to use MSW (Mock Service Worker) for offline testing, or "false" for the live FastAPI server
VITE_USE_MOCKS=false

# URL of the separate administrator web app
VITE_ADMIN_APP_URL=http://localhost:5174
```

### 2. Install Dependencies
```powershell
npm install
```

### 3. Run Development Server
```powershell
npm run dev
```
The employee client runs at `http://localhost:5173`.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build production bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the codebase |
| `npm test` | Run unit and integration test suites once via Vitest |

---

## 🌐 Application Routes

| Route | Description |
| :--- | :--- |
| `/login` | Employee sign-in with demo credentials hint and admin redirection |
| `/dashboard` | Monthly expenditure overview, category donut, and trend charts |
| `/expenses` | Filterable, sortable, and searchable table of company expenses |
| `/expenses/new` | Standard and Quick-Entry form for single or batch receipts |
| `/expenses/:id` | Detailed expense view with metadata and audit timeline |
| `/expenses/:id/edit` | Prefilled update form (restricted to the expense creator) |
| `/petty-cash` | 5-point petty cash balance strip and transaction ledger |
| `/reports` | Monthly breakdown & annual matrix with PDF and Excel export |
| `/settings` | Employee profile details, avatar, and password update |

---

## 📊 Legacy Spreadsheet Import

To re-run the spreadsheet ingestion script that parses `docs/expenditure.xlsx` into mock seed JSON files:

```powershell
npx tsx scripts/import-xlsx.ts
```

This updates:
- `src/mocks/seed/*.json`
- `docs/import-report.md` (audit report detailing unparseable amounts, total mismatches, and date anomalies)

---

## 🛠 CORS Notes (Connecting to the Backend)

Because the Employee app (`http://localhost:5173` / `https://expenses.ecom.com`) and Admin app (`http://localhost:5174` / `https://admin.expenses.ecom.com`) run on separate origins and share the FastAPI backend:
1. All API requests authenticate via **Bearer Tokens** (`Authorization: Bearer <token>`).
2. Ensure the FastAPI server's `CORS_ORIGINS` setting in [`../ecom-expenses-tracker-server/.env`](../ecom-expenses-tracker-server) includes `http://localhost:5173`.
