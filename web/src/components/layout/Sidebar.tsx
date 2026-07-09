import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MapPin,
  Package,
  UtensilsCrossed,
  Clock,
  Calendar,
  CheckSquare,
  ShoppingCart,
  ClipboardList,
  CalendarDays,
  Settings,
  Users,
  LogOut,
  ChevronDown,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useOrg } from '@/hooks/use-org'
import { hasMinRole } from '@/hooks/use-role'
import { initials } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд', minRole: 'TRAINEE' as const },
  { to: '/shifts', icon: Clock, label: 'Смены', minRole: 'TRAINEE' as const },
  { to: '/locations', icon: MapPin, label: 'Локации', minRole: 'OPS_DIRECTOR' as const },
  { to: '/products', icon: Package, label: 'Продукты', minRole: 'HEAD_BARISTA' as const },
  { to: '/recipes', icon: UtensilsCrossed, label: 'Рецепты', minRole: 'HEAD_BARISTA' as const },
  { to: '/calendar', icon: Calendar, label: 'Календарь', minRole: 'MANAGER' as const },
  { to: '/checklists', icon: CheckSquare, label: 'Чек-листы', minRole: 'MANAGER' as const },
  { to: '/orders', icon: ShoppingCart, label: 'Заказы', minRole: 'MANAGER' as const },
  { to: '/regulations', icon: ClipboardList, label: 'Регламенты', minRole: 'TRAINEE' as const },
  { to: '/schedule', icon: CalendarDays, label: 'Расписание', minRole: 'MANAGER' as const },
  { to: '/team', icon: Users, label: 'Команда', minRole: 'MANAGER' as const },
  { to: '/settings', icon: Settings, label: 'Настройки', minRole: 'OWNER' as const },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { logout } = useAuth()
  const { activeMembership, memberships, switchOrg, role } = useOrg()
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const location = useLocation()

  const filteredNav = navItems.filter((item) => hasMinRole(role, item.minRole))

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Org switcher */}
        <div className="relative border-b border-white/10 p-4">
          <button
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-hover"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              {activeMembership?.orgName ? initials(activeMembership.orgName) : '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {activeMembership?.orgName ?? 'Загрузка...'}
              </p>
              <p className="text-xs text-sidebar-text">
                {activeMembership?.taktRole?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
            {memberships.length > 1 && <ChevronDown className="h-4 w-4 text-sidebar-text" />}
          </button>

          {orgDropdownOpen && memberships.length > 1 && (
            <div className="absolute left-4 right-4 top-full z-10 mt-1 rounded-lg bg-sidebar-hover p-1 shadow-xl">
              {memberships.map((m) => (
                <button
                  key={m.orgId}
                  onClick={() => {
                    switchOrg(m.orgId)
                    setOrgDropdownOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    m.orgId === activeMembership?.orgId
                      ? 'bg-sidebar-active text-white'
                      : 'text-sidebar-text hover:text-white'
                  }`}
                >
                  {m.orgName}
                </button>
              ))}
            </div>
          )}

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1 text-sidebar-text hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {filteredNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Выйти
          </button>
        </div>
      </aside>
    </>
  )
}
