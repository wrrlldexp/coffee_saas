export interface User {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
}

export interface Membership {
  memberId: string
  orgId: string
  orgName: string
  orgSlug: string
  orgLogo: string | null
  orgPlan: string
  orgTimezone: string
  role: 'owner' | 'admin' | 'member'
  taktRole: TaktRole
  locationIds: string[]
}

export type TaktRole =
  | 'OWNER'
  | 'OPS_DIRECTOR'
  | 'HEAD_BARISTA'
  | 'MANAGER'
  | 'BARISTA'
  | 'TRAINEE'

export interface MeResponse {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  memberships: Membership[]
}

export interface Location {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  timezone: string
  isOpen: boolean
  orgId: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  unit: string
  costPrice: number | null
  orgId: string
}

export interface Shift {
  id: string
  date: string
  status: 'OPEN' | 'CLOSED'
  locationId: string
  orgId: string
  responsibleId: string | null
  createdAt: string
}

export interface CalendarTask {
  id: string
  text: string
  date: string
  done: boolean
  color: string | null
  assignedTo: string | null
  orgId: string
}

export interface Recipe {
  id: string
  name: string
  category: string | null
  ingredients: unknown
  steps: unknown
  outputUnit: string | null
  costPrice: number | null
  orgId: string
}

export interface DashboardStats {
  locations: unknown[]
  members: unknown[]
  todayShifts: unknown[]
  alerts: unknown[]
  pendingTasks: unknown[]
  weeklyStats: unknown
}
