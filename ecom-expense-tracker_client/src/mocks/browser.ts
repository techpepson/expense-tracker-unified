import { http, HttpResponse } from 'msw'
import categoriesSeed from './seed/categories.json'
import itemsSeed from './seed/items.json'
import expensesSeed from './seed/expenses.json'
import pettyCashSeed from './seed/petty-cash.json'
import usersSeed from './seed/users.json'

// Load from localStorage or initialize from seed data
function getStored<T>(key: string, defaultData: T): T {
  if (typeof window === 'undefined') return defaultData
  const item = localStorage.getItem(`ecom_${key}`)
  if (!item) {
    localStorage.setItem(`ecom_${key}`, JSON.stringify(defaultData))
    return defaultData
  }
  try {
    return JSON.parse(item)
  } catch {
    return defaultData
  }
}

function setStored<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`ecom_${key}`, JSON.stringify(data))
}

export const handlers = [
  // --- Auth ---
  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = body.email?.toLowerCase().trim()

    if (email === 'admin@ecom.com') {
      return HttpResponse.json(
        { detail: 'Administrator accounts sign in on the admin site', code: 'admin_account' },
        { status: 403 }
      )
    }

    if (email === 'employee@ecom.com' && body.password === 'password123') {
      return HttpResponse.json({
        access_token: 'mock-jwt-token-for-employee',
        token_type: 'bearer',
      })
    }

    return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
  }),

  http.get('*/api/auth/me', () => {
    const users = getStored('users', usersSeed)
    return HttpResponse.json(users[0])
  }),

  // --- Categories ---
  http.get('*/api/categories', () => {
    const categories = getStored('categories', categoriesSeed)
    return HttpResponse.json(categories)
  }),

  // --- Items ---
  http.get('*/api/items', ({ request }) => {
    const url = new URL(request.url)
    const categoryId = url.searchParams.get('category_id')
    const search = url.searchParams.get('search')?.toLowerCase()

    let items = getStored('items', itemsSeed)
    if (categoryId) {
      items = items.filter((i: any) => i.category_id === categoryId)
    }
    if (search) {
      items = items.filter((i: any) => i.name.toLowerCase().includes(search))
    }
    return HttpResponse.json(items)
  }),

  http.post('*/api/items', async ({ request }) => {
    const body = (await request.json()) as any
    const items = getStored('items', itemsSeed)
    const newItem = {
      id: `item-${Date.now()}`,
      category_id: body.category_id,
      name: body.name,
      status: 'pending',
    }
    items.push(newItem)
    setStored('items', items)
    return HttpResponse.json(newItem)
  }),

  // --- Expenses ---
  http.get('*/api/expenses', ({ request }) => {
    const url = new URL(request.url)
    const month = url.searchParams.get('month')
    const year = url.searchParams.get('year')
    const categoryId = url.searchParams.get('category_id')
    const expenseType = url.searchParams.get('expense_type')
    const search = url.searchParams.get('search')?.toLowerCase()
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '15', 10)

    let list = getStored('expenses', expensesSeed)

    if (month) {
      list = list.filter((e: any) => {
        const d = new Date(e.expense_date)
        return d.getMonth() + 1 === parseInt(month, 10)
      })
    }
    if (year) {
      list = list.filter((e: any) => {
        const d = new Date(e.expense_date)
        return d.getFullYear() === parseInt(year, 10)
      })
    }
    if (categoryId) {
      list = list.filter((e: any) => e.category_id === categoryId)
    }
    if (expenseType) {
      list = list.filter((e: any) => e.expense_type === expenseType)
    }
    if (search) {
      list = list.filter((e: any) =>
        e.item_name.toLowerCase().includes(search) ||
        (e.description && e.description.toLowerCase().includes(search))
      )
    }

    const total = list.length
    const startIndex = (page - 1) * limit
    const paginated = list.slice(startIndex, startIndex + limit)

    return HttpResponse.json({
      items: paginated,
      total,
      page,
      limit,
    })
  }),

  http.get('*/api/expenses/:id', ({ params }) => {
    const list = getStored('expenses', expensesSeed)
    const found = list.find((e: any) => e.id === params.id)
    if (!found) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(found)
  }),

  http.post('*/api/expenses', async ({ request }) => {
    const body = (await request.json()) as any
    const list = getStored('expenses', expensesSeed)
    const items = getStored('items', itemsSeed)
    const item = items.find((i: any) => i.id === body.item_id)

    const newExpense = {
      id: `exp-${Date.now()}`,
      ...body,
      item_name: item ? item.name : 'Unknown Item',
      total: Number((body.unit_cost * body.quantity).toFixed(2)),
      created_by: 'usr-1',
      created_by_name: 'John Doe',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    list.unshift(newExpense)
    setStored('expenses', list)
    return HttpResponse.json(newExpense)
  }),

  http.post('*/api/expenses/bulk', async ({ request }) => {
    const body = (await request.json()) as any[]
    const list = getStored('expenses', expensesSeed)
    const items = getStored('items', itemsSeed)

    const created = body.map((b, idx) => {
      const item = items.find((i: any) => i.id === b.item_id)
      return {
        id: `exp-${Date.now()}-${idx}`,
        ...b,
        item_name: item ? item.name : 'Unknown Item',
        total: Number((b.unit_cost * b.quantity).toFixed(2)),
        created_by: 'usr-1',
        created_by_name: 'John Doe',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })

    list.unshift(...created)
    setStored('expenses', list)
    return HttpResponse.json(created)
  }),

  http.put('*/api/expenses/:id', async ({ params, request }) => {
    const body = (await request.json()) as any
    const list = getStored('expenses', expensesSeed)
    const idx = list.findIndex((e: any) => e.id === params.id)
    if (idx === -1) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })

    const updated = {
      ...list[idx],
      ...body,
      total: Number((body.unit_cost * body.quantity).toFixed(2)),
      updated_at: new Date().toISOString(),
    }
    list[idx] = updated
    setStored('expenses', list)
    return HttpResponse.json(updated)
  }),

  http.delete('*/api/expenses/:id', ({ params }) => {
    let list = getStored('expenses', expensesSeed)
    list = list.filter((e: any) => e.id !== params.id)
    setStored('expenses', list)
    return HttpResponse.json({ success: true })
  }),

  // --- Petty Cash ---
  http.get('*/api/petty-cash', ({ request }) => {
    const url = new URL(request.url)
    const month = parseInt(url.searchParams.get('month') || '1', 10)
    const entries = getStored<any[]>('petty-cash', pettyCashSeed)

    const monthEntries = entries.filter((e: any) => {
      const d = new Date(e.entry_date)
      return d.getMonth() + 1 === month
    })

    const cashIn = monthEntries
      .filter((e: any) => e.entry_type === 'cash_in')
      .reduce((sum: number, e: any) => sum + e.amount, 0)
    const cashOut = monthEntries
      .filter((e: any) => e.entry_type === 'cash_out')
      .reduce((sum: number, e: any) => sum + e.amount, 0)
    const charges = monthEntries
      .filter((e: any) => e.entry_type === 'charge')
      .reduce((sum: number, e: any) => sum + e.amount, 0)

    const openingBalance = 500
    const closingBalance = openingBalance + cashIn - (cashOut + charges)

    return HttpResponse.json({
      opening_balance: openingBalance,
      cash_in: cashIn,
      cash_out_total: cashOut + charges,
      charges: charges,
      closing_balance: closingBalance,
      cash_used: cashOut,
      entries: monthEntries,
    })
  }),

  http.post('*/api/petty-cash/entries', async ({ request }) => {
    const body = (await request.json()) as any
    const entries = getStored<any[]>('petty-cash', pettyCashSeed)
    const newEntry = {
      id: `pc-${Date.now()}`,
      ...body,
      created_by: 'usr-1',
      created_by_name: 'John Doe',
      created_at: new Date().toISOString(),
    }
    entries.unshift(newEntry)
    setStored('petty-cash', entries)
    return HttpResponse.json(newEntry)
  }),

  // --- Reports ---
  http.get('*/api/reports/monthly', ({ request }) => {
    const url = new URL(request.url)
    const month = parseInt(url.searchParams.get('month') || '1', 10)
    const year = parseInt(url.searchParams.get('year') || '2026', 10)

    const expenses = getStored('expenses', expensesSeed)
    const categories = getStored('categories', categoriesSeed)

    const monthExpenses = expenses.filter((e: any) => {
      const d = new Date(e.expense_date)
      return d.getMonth() + 1 === month && d.getFullYear() === year
    })

    const totalPurchases = monthExpenses.reduce((sum: number, e: any) => sum + e.total, 0)
    const individualTotal = monthExpenses
      .filter((e: any) => e.expense_type === 'individual')
      .reduce((sum: number, e: any) => sum + e.total, 0)
    const sharedTotal = monthExpenses
      .filter((e: any) => e.expense_type === 'shared_operational')
      .reduce((sum: number, e: any) => sum + e.total, 0)

    const categoriesBreakdown = categories.map((cat: any) => {
      const catExpenses = monthExpenses.filter((e: any) => e.category_id === cat.id)
      const catTotal = catExpenses.reduce((sum: number, e: any) => sum + e.total, 0)

      // Group by item
      const itemMap = new Map<string, any[]>()
      catExpenses.forEach((e: any) => {
        const existing = itemMap.get(e.item_id)
        if (!existing) {
          itemMap.set(e.item_id, [e])
        } else {
          existing.push(e)
        }
      })

      const items = Array.from(itemMap.entries()).map(([itemId, entries]) => ({
        item_id: itemId,
        item_name: entries[0].item_name,
        entries,
        subtotal: entries.reduce((s, e) => s + e.total, 0),
      }))

      return {
        category_id: cat.id,
        category_name: cat.name,
        total: catTotal,
        items,
      }
    })

    return HttpResponse.json({
      month,
      year,
      total_purchases: totalPurchases,
      record_count: monthExpenses.length,
      individual_total: individualTotal,
      shared_total: sharedTotal,
      petty_cash: {
        opening_balance: 500,
        cash_in: 300,
        cash_out_total: 200,
        charges: 10,
        closing_balance: 600,
        cash_used: 190,
        entries: [],
      },
      categories: categoriesBreakdown,
      expenses: monthExpenses,
    })
  }),

  http.get('*/api/reports/annual', ({ request }) => {
    const url = new URL(request.url)
    const year = parseInt(url.searchParams.get('year') || '2026', 10)
    const expenses = getStored('expenses', expensesSeed)
    const categories = getStored('categories', categoriesSeed)
    const items = getStored('items', itemsSeed)

    const yearExpenses = expenses.filter((e: any) => {
      const d = new Date(e.expense_date)
      return d.getFullYear() === year
    })

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const total = yearExpenses
        .filter((e: any) => new Date(e.expense_date).getMonth() + 1 === m)
        .reduce((sum: number, e: any) => sum + e.total, 0)
      return { month: m, total }
    })

    const categoriesRows = categories.map((cat: any) => {
      const catExpenses = yearExpenses.filter((e: any) => e.category_id === cat.id)
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        return catExpenses
          .filter((e: any) => new Date(e.expense_date).getMonth() + 1 === m)
          .reduce((sum: number, e: any) => sum + e.total, 0)
      })

      const catItems = items.filter((it: any) => it.category_id === cat.id).map((it: any) => {
        const itExpenses = catExpenses.filter((e: any) => e.item_id === it.id)
        const itMonthlyTotals = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1
          return itExpenses
            .filter((e: any) => new Date(e.expense_date).getMonth() + 1 === m)
            .reduce((sum: number, e: any) => sum + e.total, 0)
        })
        return {
          item_id: it.id,
          item_name: it.name,
          monthly_totals: itMonthlyTotals,
          year_total: itMonthlyTotals.reduce((a, b) => a + b, 0),
        }
      })

      return {
        category_id: cat.id,
        category_name: cat.name,
        items: catItems,
        monthly_totals: monthlyTotals,
        year_total: monthlyTotals.reduce((a, b) => a + b, 0),
      }
    })

    const grandTotal = months.reduce((sum, m) => sum + m.total, 0)

    return HttpResponse.json({
      year,
      months,
      categories: categoriesRows,
      grand_total: grandTotal,
    })
  }),

  // --- Profile ---
  http.get('*/api/users/lookup', () => {
    const users = getStored('users', usersSeed)
    return HttpResponse.json(users.map((u: any) => ({ id: u.id, full_name: u.full_name })))
  }),

  http.put('*/api/me', async ({ request }) => {
    const body = (await request.json()) as any
    const users = getStored('users', usersSeed)
    users[0] = { ...users[0], ...body }
    setStored('users', users)
    return HttpResponse.json(users[0])
  }),

  http.put('*/api/me/password', () => {
    return HttpResponse.json({ success: true })
  }),

  http.post('*/api/me/avatar', () => {
    return HttpResponse.json({
      ...getStored('users', usersSeed)[0],
      profile_picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    })
  }),
]
