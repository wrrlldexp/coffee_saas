import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { useRecipes, useCreateRecipe, useDeleteRecipe } from '@/api/queries/use-recipes'
import { UtensilsCrossed, Plus, Trash2, Loader2 } from 'lucide-react'

export function RecipesPage() {
  const { data: recipes, isLoading } = useRecipes()
  const createRecipe = useCreateRecipe()
  const deleteRecipe = useDeleteRecipe()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createRecipe.mutateAsync({ name, category: category || undefined } as any)
    setName('')
    setCategory('')
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
        title="Рецепты"
        description="Рецептура и технологические карты"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="Латте"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Категория</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="Напитки"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={createRecipe.isPending}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {createRecipe.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
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

      {!recipes || recipes.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Нет рецептов"
          description="Добавьте рецепты для стандартизации приготовления"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text">{r.name}</h3>
                  {r.category && (
                    <span className="mt-1 inline-block rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-text-secondary">
                      {r.category}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm('Удалить рецепт?')) deleteRecipe.mutate(r.id)
                  }}
                  className="rounded-md p-1 text-text-muted hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {r.costPrice != null && (
                <p className="mt-3 text-sm text-text-secondary">
                  Себестоимость: <span className="font-medium text-text">{r.costPrice} ₽</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
