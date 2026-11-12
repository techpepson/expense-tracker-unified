import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Copy, KeyRound, Pencil, Plus, RotateCcw, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, useResetPassword, useUsers } from '@/api'
import type { Role, User } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { pluralize } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, PageHeader, UserChip } from '@/components/shared'

export function UsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')

  const { data: users, isLoading } = useUsers({
    search: debouncedSearch || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  })
  const resetPassword = useResetPassword()

  const [resetResult, setResetResult] = useState<{ user: User; password: string } | null>(null)

  const list = useMemo(() => users ?? [], [users])
  const stats = useMemo(() => {
    const admins = list.filter((u) => u.role === 'admin').length
    const sharedRecorders = list.filter((u) => u.can_record_shared).length
    const active = list.filter((u) => u.is_active).length
    return { total: list.length, admins, sharedRecorders, active }
  }, [list])

  const hasActiveFilters = Boolean(search.trim() || roleFilter || statusFilter)

  const resetFilters = () => {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('')
  }

  const handleResetPassword = async (user: User) => {
    try {
      const res = await resetPassword.mutateAsync(user.id)
      setResetResult({ user, password: res.temporary_password })
      toast.success(`Generated temporary password for ${user.full_name}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'User',
        cell: ({ row }) => (
          <UserChip
            name={row.original.full_name}
            email={row.original.email}
            avatarUrl={row.original.profile_picture}
          />
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge variant={row.original.role === 'admin' ? 'admin' : 'employee'}>
            {row.original.role === 'admin' ? 'Admin' : 'Employee'}
          </Badge>
        ),
      },
      {
        accessorKey: 'can_record_shared',
        header: 'Shared recorder',
        cell: ({ row }) => (
          <Badge variant={row.original.can_record_shared ? 'shared' : 'inactive'}>
            {row.original.can_record_shared ? 'Yes' : 'No'}
          </Badge>
        ),
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'active' : 'inactive'}>
            {row.original.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/users/${row.original.id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResetPassword(row.original)}
              disabled={resetPassword.isPending}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Reset password
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage employee and administrator accounts and designated shared expense recorders"
        actions={
          <Button asChild>
            <Link to="/users/new">
              <Plus className="h-4 w-4" />
              Add User
            </Link>
          </Button>
        }
      />

      <div className="app-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-divider)] pb-3.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] dark:bg-[#172554] px-3 py-1 font-semibold text-[#1E3A8A] dark:text-[#DBEAFE]">
              <Users className="h-3.5 w-3.5 text-[#2563EB]" />
              {pluralize(stats.total, 'user')}
            </span>
            <Badge variant="admin">{pluralize(stats.admins, 'admin')}</Badge>
            <Badge variant="shared">{pluralize(stats.sharedRecorders, 'shared recorder')}</Badge>
            <Badge variant="active">{stats.active} active</Badge>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
            <Input
              aria-label="Search users"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="w-48">
            <Select
              aria-label="Filter users by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | '')}
            >
              <option value="">All roles</option>
              <option value="admin">Administrators</option>
              <option value="employee">Employees</option>
            </Select>
          </div>

          <div className="w-44">
            <Select
              aria-label="Filter users by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | '')}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>

        <DataTable columns={columns} data={list} loading={isLoading} />
      </div>

      {/* Reset Password Result Dialog */}
      <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password generated</DialogTitle>
            <DialogDescription>
              Share this temporary password securely with{' '}
              <strong>{resetResult?.user.full_name}</strong> ({resetResult?.user.email}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-[12px] border border-[#BFDBFE] bg-[#EFF6FF] dark:bg-[#172554] p-3.5 font-mono text-base font-bold text-[#1E3A8A] dark:text-white">
            <span>{resetResult?.password}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (resetResult?.password) {
                  void navigator.clipboard?.writeText(resetResult.password)
                  toast.success('Copied temporary password')
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

