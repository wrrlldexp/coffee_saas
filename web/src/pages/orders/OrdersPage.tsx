import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { ShoppingCart, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Order {
  id: string
  status: string
  totalAmount: number
  items: unknown[]
  createdAt: string
}

export function OrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api<Order[]>('GET', '/api/orders'),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
  }

  return (
    <div>
      <PageHeader title="Заказы" description="Заказы поставщикам" />

      {!orders || orders.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Нет заказов" description="Заказы появятся здесь" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Статус</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-bg-subtle/50">
                  <td className="px-4 py-3 text-sm text-text">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-medium text-text-secondary">
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-text">{o.totalAmount} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
