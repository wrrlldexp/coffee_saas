import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/onboarding/LoginPage'
import { SignupPage } from '@/pages/onboarding/SignupPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LocationsPage } from '@/pages/locations/LocationsPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { RecipesPage } from '@/pages/recipes/RecipesPage'
import { ShiftsPage } from '@/pages/shifts/ShiftsPage'
import { CalendarPage } from '@/pages/calendar/CalendarPage'
import { ChecklistsPage } from '@/pages/checklists/ChecklistsPage'
import { OrdersPage } from '@/pages/orders/OrdersPage'
import { RegulationsPage } from '@/pages/regulations/RegulationsPage'
import { SchedulePage } from '@/pages/schedule/SchedulePage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { TeamPage } from '@/pages/team/TeamPage'
import { AdminLogin } from '@/pages/admin/AdminLogin'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { LoadingScreen } from '@/components/shared/LoadingScreen'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (isAuthenticated) return <Navigate to="/" replace />

  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      {/* Guest routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />

      {/* Admin routes */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />

      {/* Protected app routes */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="checklists" element={<ChecklistsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="regulations" element={<RegulationsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="team" element={<TeamPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
