import { useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { createCategory, deleteCategory, swapCategoryOrder, updateCategory } from '../data/records'
import { useRows } from '../data/use-data'
import type { Category, CategoryGroup } from '../db/types'
import { groupTitle } from '../domain/catalog'
import { sectionCategories } from '../domain/places'
import { Sheet } from '../ui/components'
import { IconChevronDown, IconTrash, IconUp } from '../ui/icons'

/** Редактор категорий раздела (или товаров): переименовать, значок, порядок, удалить, добавить. */
export function CategoriesSheet(props: { section: CategoryGroup; onClose: () => void }) {
  const { db } = useApp()
  const categories = useRows('categories')
  const places = useRows('places')
  const items = useRows('items')
  const list = sectionCategories(categories ?? [], props.section)
  const forItems = props.section === 'items'
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')

  const usage = (id: string) => ((forItems ? items : places) ?? []).filter((r) => r.categoryIds.includes(id)).length

  async function add(event: Event) {
    event.preventDefault()
    if (!name.trim()) return
    await createCategory(db, props.section, name, emoji || '📍')
    setName('')
    setEmoji('')
  }

  async function remove(category: Category) {
    const n = usage(category.id)
    const tail = n ? (forItems ? ` Она снимется с товаров: ${n} (сами товары останутся).` : ` Она снимется с мест: ${n} (сами места останутся).`) : ''
    if (confirm(`Удалить категорию «${category.name}»?${tail}`)) await deleteCategory(db, category.id)
  }

  return (
    <Sheet title={`Категории · ${groupTitle(props.section)}`} onClose={props.onClose}>
      <ul class="cat-editor">
        {list.map((c, i) => (
          <li class="cat-editor__row" key={c.id}>
            <input
              class="cat-editor__emoji"
              aria-label="Значок"
              value={c.emoji}
              maxLength={4}
              onChange={(e) => void updateCategory(db, c.id, { emoji: e.currentTarget.value.trim() || '📍' })}
            />
            <input class="cat-editor__name" aria-label="Название" value={c.name} onChange={(e) => e.currentTarget.value.trim() && void updateCategory(db, c.id, { name: e.currentTarget.value.trim() })} />
            <span class="cat-editor__count num" title={forItems ? 'Товаров в категории' : 'Мест в категории'}>
              {usage(c.id) || ''}
            </span>
            <button class="icon-btn" type="button" aria-label="Выше" disabled={i === 0} onClick={() => void swapCategoryOrder(db, c, list[i - 1])}>
              <IconUp size={18} />
            </button>
            <button class="icon-btn" type="button" aria-label="Ниже" disabled={i === list.length - 1} onClick={() => void swapCategoryOrder(db, c, list[i + 1])}>
              <IconChevronDown size={18} />
            </button>
            <button class="icon-btn" type="button" aria-label="Удалить" onClick={() => void remove(c)}>
              <IconTrash size={18} />
            </button>
          </li>
        ))}
      </ul>
      <form class="cat-editor__add" onSubmit={add}>
        <input class="cat-editor__emoji" aria-label="Значок" placeholder="🍜" value={emoji} maxLength={4} onInput={(e) => setEmoji(e.currentTarget.value)} />
        <input class="cat-editor__name" aria-label="Новая категория" placeholder="Новая категория" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <button class="btn btn--primary btn--small" type="submit" disabled={!name.trim()}>
          Добавить
        </button>
      </form>
      <p class="hint">Значок — любой эмодзи. Изменения сохраняются сразу.</p>
    </Sheet>
  )
}
