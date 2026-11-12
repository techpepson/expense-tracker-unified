import { delay, http, HttpResponse, type JsonBodyType } from 'msw'
import type { ExpenseType, ImportPayload, ItemStatus, Role, Settings } from '@/types'
import { loadDb, saveDb, type MockDb } from './db'
import * as svc from './service'

const LATENCY = import.meta.env.MODE === 'test' ? 0 : 250

function tokenOf(request: Request): string | null {
  const h = request.headers.get('Authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

function errorResponse(err: unknown) {
  if (err instanceof svc.ServiceError) {
    return HttpResponse.json({ message: err.message, code: err.code, errors: err.errors }, { status: err.status })
  }
  console.error('[mock api]', err)
  return HttpResponse.json({ message: 'Unexpected mock server error' }, { status: 500 })
}

type Ctx = { db: MockDb; request: Request; params: Record<string, string | readonly string[] | undefined>; url: URL; actorId: string }

/** Wraps a handler: latency, admin auth, persistence and error mapping. */
function admin(fn: (ctx: Ctx) => JsonBodyType | Promise<JsonBodyType>, status = 200) {
  return async ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    await delay(LATENCY)
    const db = loadDb()
    try {
      const actor = svc.requireAdmin(db, tokenOf(request))
      const result = await fn({ db, request, params, url: new URL(request.url), actorId: actor.id })
      saveDb(db)
      return status === 204 ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(result, { status })
    } catch (err) {
      return errorResponse(err)
    }
  }
}

const num = (url: URL, key: string) => {
  const v = url.searchParams.get(key)
  return v ? Number(v) : undefined
}
const str = (url: URL, key: string) => url.searchParams.get(key) ?? undefined
const id = (params: Ctx['params']) => String(params.id)
async function body<T>(request: Request): Promise<T> {
  return (await request.json()) as T
}

const today = new Date()

export const handlers = [
  // ---- Auth ----
  http.post('*/api/auth/login', async ({ request }) => {
    await delay(LATENCY)
    const db = loadDb()
    try {
      const { email, password } = await body<{ email: string; password: string }>(request)
      const res = svc.login(db, email ?? '', password ?? '')
      saveDb(db)
      return HttpResponse.json(res)
    } catch (err) {
      return errorResponse(err)
    }
  }),
  http.get('*/api/auth/me', admin(({ db, request }) => svc.me(db, tokenOf(request)))),
  http.post('*/api/auth/logout', admin(({ db, request }) => {
    svc.logout(db, tokenOf(request))
    return { ok: true }
  })),

  // ---- Dashboard ----
  http.get('*/api/admin/dashboard', admin(({ db, url }) =>
    svc.dashboard(db, num(url, 'month') ?? today.getMonth() + 1, num(url, 'year') ?? today.getFullYear()),
  )),

  // ---- Categories ----
  http.get('*/api/admin/categories', admin(({ db }) => svc.listCategories(db))),
  http.post('*/api/admin/categories', admin(async ({ db, request }) => svc.createCategory(db, await body(request)), 201)),
  http.put('*/api/admin/categories/reorder', admin(async ({ db, request }) => svc.reorderCategories(db, (await body<{ ids: string[] }>(request)).ids))),
  http.put('*/api/admin/categories/:id', admin(async ({ db, request, params }) => svc.updateCategory(db, id(params), await body(request)))),

  // ---- Items ----
  http.get('*/api/admin/items', admin(({ db, url }) =>
    svc.listItems(db, { status: str(url, 'status') as ItemStatus | undefined, category_id: str(url, 'category_id'), search: str(url, 'search') }),
  )),
  http.post('*/api/admin/items', admin(async ({ db, request }) => svc.createItem(db, await body(request)), 201)),
  http.put('*/api/admin/items/:id', admin(async ({ db, request, params }) => svc.updateItem(db, id(params), await body(request)))),
  http.post('*/api/admin/items/:id/merge', admin(async ({ db, request, params }) =>
    svc.mergeItem(db, id(params), (await body<{ target_id: string }>(request)).target_id),
  )),
  http.post('*/api/admin/items/:id/approve', admin(({ db, params }) => svc.approveItem(db, id(params)))),
  http.post('*/api/admin/items/:id/reject', admin(({ db, params }) => {
    svc.rejectItem(db, id(params))
    return { ok: true }
  })),

  // ---- Users ----
  http.get('*/api/admin/users', admin(({ db, url }) =>
    svc.listUsers(db, { search: str(url, 'search'), role: str(url, 'role') as Role | undefined, status: str(url, 'status') as 'active' | 'inactive' | undefined }),
  )),
  http.post('*/api/admin/users', admin(async ({ db, request }) => svc.createUser(db, await body(request)), 201)),
  http.put('*/api/admin/users/:id', admin(async ({ db, request, params, actorId }) => svc.updateUser(db, id(params), await body(request), actorId))),
  http.post('*/api/admin/users/:id/reset-password', admin(({ db, params }) => svc.resetPassword(db, id(params)))),

  // ---- Expenses ----
  http.get('*/api/admin/expenses', admin(({ db, url }) =>
    svc.listExpenses(db, {
      month: num(url, 'month'),
      year: num(url, 'year'),
      category_id: str(url, 'category_id'),
      item_id: str(url, 'item_id'),
      expense_type: str(url, 'expense_type') as ExpenseType | undefined,
      created_by: str(url, 'created_by'),
      search: str(url, 'search'),
      page: num(url, 'page'),
      limit: num(url, 'limit'),
      sort: str(url, 'sort'),
    }),
  )),
  http.post('*/api/admin/expenses/bulk', admin(async ({ db, request, actorId }) =>
    svc.createExpensesBulk(db, (await body<{ lines: svc.ExpenseInput[] }>(request)).lines, actorId), 201,
  )),
  http.post('*/api/admin/expenses', admin(async ({ db, request, actorId }) => svc.createExpense(db, await body(request), actorId), 201)),
  http.get('*/api/admin/expenses/:id', admin(({ db, params }) => svc.getExpense(db, id(params)))),
  http.put('*/api/admin/expenses/:id', admin(async ({ db, request, params, actorId }) => svc.updateExpense(db, id(params), await body(request), actorId))),
  http.delete('*/api/admin/expenses/:id', admin(({ db, params }) => {
    svc.deleteExpense(db, id(params))
    return null
  }, 204)),

  // ---- Petty cash ----
  http.get('*/api/admin/petty-cash', admin(({ db, url }) =>
    svc.pettyCashMonth(db, num(url, 'month') ?? today.getMonth() + 1, num(url, 'year') ?? today.getFullYear()),
  )),
  http.post('*/api/admin/petty-cash/entries', admin(async ({ db, request, actorId }) => svc.createPettyCash(db, await body(request), actorId), 201)),
  http.put('*/api/admin/petty-cash/entries/:id', admin(async ({ db, request, params }) => svc.updatePettyCash(db, id(params), await body(request)))),
  http.delete('*/api/admin/petty-cash/entries/:id', admin(({ db, params }) => {
    svc.deletePettyCash(db, id(params))
    return null
  }, 204)),
  http.put('*/api/admin/petty-cash/opening-balance', admin(async ({ db, request }) => svc.setOpeningBalance(db, await body(request)))),

  // ---- Reports ----
  http.get('*/api/admin/reports/monthly', admin(({ db, url }) =>
    svc.monthlyReport(db, num(url, 'month') ?? today.getMonth() + 1, num(url, 'year') ?? today.getFullYear(), str(url, 'created_by')),
  )),
  http.get('*/api/admin/reports/annual', admin(({ db, url }) => svc.annualReport(db, num(url, 'year') ?? today.getFullYear()))),

  // ---- Import ----
  http.post('*/api/admin/import', admin(async ({ db, request, actorId }) => svc.applyImport(db, await body<ImportPayload>(request), actorId))),

  // ---- Settings & profile ----
  http.get('*/api/admin/settings', admin(({ db }) => db.settings)),
  http.put('*/api/admin/settings', admin(async ({ db, request }) => svc.updateSettings(db, await body<Partial<Settings>>(request)))),
  http.put('*/api/me/password', admin(async ({ db, request, actorId }) => {
    const b = await body<{ current_password: string; new_password: string }>(request)
    svc.changePassword(db, actorId, b.current_password, b.new_password)
    return { ok: true }
  })),
  http.post('*/api/me/avatar', admin(async ({ db, request, actorId }) => {
    const form = await request.formData()
    const file = form.get('avatar')
    if (!(file instanceof File)) throw new svc.ServiceError(422, 'Choose an image', 'validation_error', { avatar: ['Choose an image'] })
    if (file.size > 2 * 1024 * 1024) throw new svc.ServiceError(422, 'Image must be 2 MB or smaller', 'validation_error', { avatar: ['Image must be 2 MB or smaller'] })
    const bytes = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    bytes.forEach((b) => (bin += String.fromCharCode(b)))
    return svc.setAvatar(db, actorId, `data:${file.type || 'image/png'};base64,${btoa(bin)}`)
  })),
  http.put('*/api/me', admin(async ({ db, request, actorId }) => svc.updateProfile(db, actorId, await body(request)))),
]

