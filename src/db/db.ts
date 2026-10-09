import Dexie, { type EntityTable } from 'dexie'
import type { Category, Guide, InboxItem, Item, MetaRow, Place, SyncMeta } from './types'

/** Синхронизируемые таблицы и тип их записей. */
export interface SyncedTables {
  places: Place
  categories: Category
  guides: Guide
  inbox: InboxItem
  items: Item
}

export type JapanDB = Dexie & { [K in keyof SyncedTables]: EntityTable<SyncedTables[K], 'id'> } & {
  meta: EntityTable<MetaRow, 'key'>
}

/** Какие локальные таблицы синхронизируются и под каким kind они лежат в облачной таблице jp_records. */
export const SYNCED_TABLES = [
  { table: 'places', kind: 'place' },
  { table: 'categories', kind: 'category' },
  { table: 'guides', kind: 'guide' },
  { table: 'inbox', kind: 'inbox' },
  { table: 'items', kind: 'item' },
] as const satisfies readonly { table: keyof SyncedTables; kind: string }[]

export type SyncedTableName = (typeof SYNCED_TABLES)[number]['table']

export function createDb(name = 'japan'): JapanDB {
  const db = new Dexie(name) as JapanDB
  db.version(1).stores({
    places: 'id, dirty, section',
    categories: 'id, dirty, section',
    guides: 'id, dirty',
    inbox: 'id, dirty',
    meta: 'key',
  })
  // v2: товары («Что купить»).
  db.version(2).stores({ items: 'id, dirty' })
  return db
}

export function syncedTable(db: JapanDB, name: SyncedTableName): EntityTable<SyncMeta, 'id'> {
  return db.table(name)
}

export async function clearAll(db: JapanDB): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
}
