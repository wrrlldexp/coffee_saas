import { Menu } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { initials } from '@/lib/utils'

interface TopBarProps {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth()

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4 lg:hidden">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-text-secondary hover:bg-bg-subtle"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1">
        <span className="text-sm font-semibold text-text">takt</span>
      </div>

      {user && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
          {initials(user.name ?? '')}
        </div>
      )}
    </header>
  )
}
