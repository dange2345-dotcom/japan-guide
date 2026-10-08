import type { JapanDB, SyncedTables } from '../db/db'
import { emitLocalChange, nextStamp } from '../db/changes'
import type { SyncMeta } from '../db/types'
import { assertCanEdit } from './access'

// Общие функции записи для всех разделов: запись помечается dirty, время изменения растёт,
// а движок синхронизации получает сигнал отправить её в облако. Зрителю записывать нельзя.

export type TableName = keyof SyncedTables
export type Fields<T extends SyncMeta> = Omit<T, keyof SyncMeta>
type Row<N extends TableName> = SyncedTables[N]

/** Создать запись. С заданным id — создать или «оживить» удалённую. */
export async function insert<N extends TableName>(
  db: JapanDB,
  name: N,
  fields: Fields<Row<N>>,
  id: string = crypto.randomUUID(),
): Promise<string> {
  assertCanEdit()
  const table = db.table(name)
  await db.transaction('rw', table, async () => {
    const prev = (await table.get(id)) as SyncMeta | undefined
    await table.put({ ...fields, id, updatedAt: nextStamp(prev), deleted: 0, dirty: 1 })
  })
  emitLocalChange()
  return id
}

export async function update<N extends TableName>(db: JapanDB, name: N, id: string, changes: Partial<Fields<Row<N>>>) {
  await updateMany(db, name, [id], () => changes)
}

/** Изменить несколько записей одной транзакцией; changes получает текущую версию записи. */
export async function updateMany<N extends TableName>(
  db: JapanDB,
  name: N,
  ids: string[],
  changes: (row: Row<N>) => Partial<Fields<Row<N>>>,
) {
  assertCanEdit()
  if (ids.length === 0) return
  const table = db.table(name)
  await db.transaction('rw', table, async () => {
    for (const id of ids) {
      const prev = (await table.get(id)) as Row<N> | undefined
      if (!prev) continue
      await table.put({ ...prev, ...changes(prev), updatedAt: nextStamp(prev), dirty: 1 })
    }
  })
  emitLocalChange()
}

/** Удаление = пометка deleted, чтобы оно доехало до других устройств. */
export async function remove(db: JapanDB, name: TableName, ids: string | string[]) {
  assertCanEdit()
  const list = typeof ids === 'string' ? [ids] : ids
  if (list.length === 0) return
  const table = db.table(name)
  await db.transaction('rw', table, async () => {
    for (const id of list) {
      const prev = (await table.get(id)) as SyncMeta | undefined
      if (!prev || prev.deleted) continue
      await table.put({ ...prev, deleted: 1, updatedAt: nextStamp(prev), dirty: 1 })
    }
  })
  emitLocalChange()
}

/** Порядковый номер для новой записи — в конец списка. */
export async function nextOrder(db: JapanDB, name: TableName): Promise<number> {
  const rows = (await db.table(name).toArray()) as { order?: number; deleted?: number }[]
  return rows.reduce((max, row) => Math.max(max, row.order ?? 0), 0) + 1
}
