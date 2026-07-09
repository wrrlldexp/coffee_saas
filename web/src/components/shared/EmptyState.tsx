import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-xl bg-bg-subtle p-4">
        <Icon className="h-8 w-8 text-text-muted" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-text">{title}</h3>
      {description && <p className="mb-4 text-sm text-text-secondary">{description}</p>}
      {action}
    </div>
  )
}
