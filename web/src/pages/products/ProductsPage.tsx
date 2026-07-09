import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useProducts, useCreateProduct, useDeleteProduct } from '@/api/queries/use-products'
import { Package, Plus, Trash2, Loader2 } from 'lucide-react'

export function ProductsPage() {
  const { data: products, isLoading } = useProducts()
  const createProduct = useCreateProduct()
  const deleteProduct = useDeleteProduct()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('шт')
  const [costPrice, setCostPrice] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createProduct.mutateAsync({
      name,
      unit,
      costPrice: costPrice ? Number(costPrice) : undefined,
    })
    setName('')
    setUnit('шт')
    setCostPrice('')
    setShowForm(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Продукты"
        description="Управление товарами"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="Капучино"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Единица</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="шт">шт</option>
                <option value="кг">кг</option>
                <option value="л">л</option>
                <option value="г">г</option>
                <option value="мл">мл</option>
                <option value="уп">уп</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Себестоимость</label>
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={createProduct.isPending}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {createProduct.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Создать
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-subtle"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {!products || products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Нет продуктов"
          description="Добавьте товары для учёта"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Единица</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Себестоимость</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-bg-subtle/50">
                  <td className="px-4 py-3 text-sm font-medium text-text">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{p.unit}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {p.costPrice != null ? `${p.costPrice} ₽` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Удалить продукт?')) deleteProduct.mutate(p.id)
                      }}
                      className="rounded-md p-1 text-text-muted hover:bg-danger-bg hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
