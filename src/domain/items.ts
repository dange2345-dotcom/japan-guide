import type { Category, Item, ItemStatus } from '../db/types'
import { normalize } from './places'

// «Что купить»: фильтр, порядок, поиск и дубли товаров. Общие для приложения и scripts/japan.ts.

export type ItemStatusFilter = 'all' | ItemStatus

export interface ItemFilter {
  /** null — все категории. */
  category: string | null
  status: ItemStatusFilter
}

const STATUS_ORDER: Record<ItemStatus, number> = { want: 0, note: 1, bought: 2 }

/** Сначала «купить», потом «на заметку», купленное — в конце; внутри — по алфавиту. */
export function compareItems(a: Item, b: Item): number {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'ru')
}

export function matchesItemFilter(item: Item, filter: ItemFilter): boolean {
  if (filter.category && !item.categoryIds.includes(filter.category)) return false
  if (filter.status !== 'all' && item.status !== filter.status) return false
  return true
}

export function filterItems(items: Item[], filter: ItemFilter): Item[] {
  return items.filter((i) => matchesItemFilter(i, filter)).sort(compareItems)
}

/** Сколько товаров в каждой категории (с учётом статуса, без учёта выбранной категории). */
export function itemCategoryCounts(items: Item[], filter: ItemFilter): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!matchesItemFilter(item, { ...filter, category: null })) continue
    for (const id of item.categoryIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Поиск: название (рус. и яп.), где купить, заметка, категория. */
export function searchItems(items: Item[], query: string, categories: Category[] = []): Item[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  return items
    .filter((i) => {
      const haystack = normalize([i.name, i.nameJa, i.where, i.note, ...i.categoryIds.map((id) => categoryName.get(id) ?? '')].join(' '))
      return words.every((word) => haystack.includes(word))
    })
    .sort(compareItems)
}

/** Уже есть такой товар? Совпало название — русское/латиницей или японское. */
export function findDuplicateItem<T extends Pick<Item, 'name' | 'nameJa'>>(existing: T[], probe: Pick<Item, 'name' | 'nameJa'>): T | undefined {
  const name = normalize(probe.name)
  const ja = normalize(probe.nameJa)
  return existing.find((i) => (name && normalize(i.name) === name) || (ja && normalize(i.nameJa) === ja))
}

/** Пустой товар со значениями по умолчанию — основа для формы, импорта и CLI. */
export function blankItem(): Omit<Item, 'id' | 'updatedAt' | 'deleted' | 'dirty'> {
  return {
    name: '',
    nameJa: '',
    categoryIds: [],
    note: '',
    where: '',
    shopIds: [],
    price: '',
    sourceUrls: [],
    photo: null,
    status: 'want',
    createdAt: Date.now(),
  }
}
