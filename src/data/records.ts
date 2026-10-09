import type { JapanDB } from '../db/db'
import type { Category, CategoryGroup, Guide, GuideTopic, InboxItem, Item, Place } from '../db/types'
import { insert, nextOrder, remove, update, updateMany, type Fields } from './entities'

// Обёртки записи по разделам. Все правки идут через entities (dirty, время, проверка роли).

export type PlaceFields = Fields<Place>

/** id можно задать заранее — фото загружается в папку места до сохранения. */
export function createPlace(db: JapanDB, fields: PlaceFields, id?: string): Promise<string> {
  return insert(db, 'places', fields, id)
}

export function updatePlace(db: JapanDB, id: string, changes: Partial<PlaceFields>) {
  return update(db, 'places', id, changes)
}

export function deletePlace(db: JapanDB, id: string) {
  return remove(db, 'places', id)
}

/* ---------- товары («Что купить») ---------- */

export type ItemFields = Fields<Item>

/** id можно задать заранее — фото загружается в папку товара до сохранения. */
export function createItem(db: JapanDB, fields: ItemFields, id?: string): Promise<string> {
  return insert(db, 'items', fields, id)
}

export function updateItem(db: JapanDB, id: string, changes: Partial<ItemFields>) {
  return update(db, 'items', id, changes)
}

export function deleteItem(db: JapanDB, id: string) {
  return remove(db, 'items', id)
}

/* ---------- категории ---------- */

export async function createCategory(db: JapanDB, section: CategoryGroup, name: string, emoji: string): Promise<string> {
  return insert(db, 'categories', { section, name: name.trim(), emoji: emoji.trim(), order: await nextOrder(db, 'categories') } satisfies Fields<Category>)
}

export function updateCategory(db: JapanDB, id: string, changes: Partial<Fields<Category>>) {
  return update(db, 'categories', id, changes)
}

/** Удалить категорию и убрать её из мест и товаров (сами они остаются). */
export async function deleteCategory(db: JapanDB, id: string) {
  const places = (await db.places.toArray()).filter((p) => !p.deleted && p.categoryIds.includes(id))
  await updateMany(db, 'places', places.map((p) => p.id), (p) => ({ categoryIds: p.categoryIds.filter((c) => c !== id) }))
  const items = (await db.items.toArray()).filter((i) => !i.deleted && i.categoryIds.includes(id))
  await updateMany(db, 'items', items.map((i) => i.id), (i) => ({ categoryIds: i.categoryIds.filter((c) => c !== id) }))
  await remove(db, 'categories', id)
}

/** Поменять местами соседние категории (стрелки ↑↓ в редакторе). */
export async function swapCategoryOrder(db: JapanDB, a: Category, b: Category) {
  await update(db, 'categories', a.id, { order: b.order })
  await update(db, 'categories', b.id, { order: a.order === b.order ? a.order + 1 : a.order })
}

/* ---------- гайды ---------- */

export async function createGuide(db: JapanDB, topic: GuideTopic, title: string, body: string): Promise<string> {
  return insert(db, 'guides', { topic, title: title.trim(), body, order: await nextOrder(db, 'guides') } satisfies Fields<Guide>)
}

export function updateGuide(db: JapanDB, id: string, changes: Partial<Fields<Guide>>) {
  return update(db, 'guides', id, changes)
}

export function deleteGuide(db: JapanDB, id: string) {
  return remove(db, 'guides', id)
}

/* ---------- входящие ---------- */

export function addInbox(db: JapanDB, text: string): Promise<string> {
  return insert(db, 'inbox', { text: text.trim(), createdAt: Date.now(), doneAt: null } satisfies Fields<InboxItem>)
}

export function setInboxDone(db: JapanDB, id: string, done: boolean) {
  return update(db, 'inbox', id, { doneAt: done ? Date.now() : null })
}

export function deleteInbox(db: JapanDB, id: string) {
  return remove(db, 'inbox', id)
}
