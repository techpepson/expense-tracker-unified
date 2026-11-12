<<<<<<< HEAD
# e-COM Expense Tracker (Employee App)

Internal expense tracking application for **e-COM Services**. Automates and replaces the manual Excel sheet process ("Expenditure Tracker") with real-time totals, petty cash management, reporting, and export capabilities.

---

## 🔒 Scope & Permissions
- **Employee-Only App**: Designed strictly for staff. Administrators manage user permissions and category catalogs on a separate domain.
- **Admin Redirection**: If an administrator attempts to sign in (`403` with code `admin_account`), the app shows a link directing them to `VITE_ADMIN_APP_URL`.
- **Designated Expense Recorder**: Users with `can_record_shared: true` can record Shared Operational expenses and record/edit Petty Cash entries. Other users have read-only access to Petty Cash and can record Individual expenses only.
- **Ownership**: Employees can edit and delete only the expense records they created.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Environment Variables
Copy `.env.example` to `.env`:

```env
# URL for the FastAPI backend (when connected to real backend)
VITE_API_BASE_URL=http://localhost:8000

# Set to "true" to use MSW (Mock Service Worker) for offline testing
VITE_USE_MOCKS=true

# URL of the separate admin web app
VITE_ADMIN_APP_URL=https://admin.expenses.ecom.com
```

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Build & Type-Check
```bash
npm run build
```

### Linting & Tests
```bash
npm run lint
npm test
```

---

## 📊 Legacy Spreadsheet Import
To re-run the spreadsheet ingestion script that parses `docs/expenditure.xlsx` into mock seed data:

```bash
npx tsx scripts/import-xlsx.ts
```

This updates:
- `src/mocks/seed/*.json`
- `docs/import-report.md` (audit report detailing all unparseable amounts, total mismatches, and date anomalies)

---

## 🌐 Routes Overview

| Route | Description |
|---|---|
| `/login` | Employee sign in with demo credentials hint and admin redirection |
| `/dashboard` | Monthly expenditure overview, category donut, and trend charts |
| `/expenses` | Filterable and searchable table of company expenses |
| `/expenses/new` | Standard and Quick-Entry form for batch receipts |
| `/expenses/:id` | Detailed view with approval badges and audit timeline |
| `/expenses/:id/edit` | Prefilled update form (restricted to owner) |
| `/petty-cash` | 5-point balance strip and ledger |
| `/reports` | Monthly breakdown & Annual matrix with PDF and Excel export |
| `/settings` | Profile information, avatar upload, and password update |

---

## 🛠 CORS Notes (When Connecting to Real Backend)
Because the Employee app and Admin app are hosted on different domains and share the same FastAPI backend:
1. All API endpoints use **Bearer Tokens** (`Authorization: Bearer <token>`). No cookies are shared across domains.
2. The FastAPI backend must configure CORS middleware:
   ```python
   origins = [
       "http://localhost:5173",
       "https://expenses.ecom.com",
       "https://admin.expenses.ecom.com"
   ]
   ```
=======
# expense-tracker-client
This is the source code for the expense tracker application that tracks and monitors expenses entered by users.
>>>>>>> 8b6a154d944c31add51c17b003ccd43c1b5778cf
