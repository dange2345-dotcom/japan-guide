import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb, SYNCED_TABLES, type JapanDB } from '../db/db'
import { setRole } from '../data/access'
import { createCategory, createPlace, deletePlace, updatePlace } from '../data/records'
import { blankPlace } from '../domain/places'
import { serverTime } from './convert'
import { createSyncEngine } from './engine'
import type { OutgoingRow, Remote, RemoteRow } from './remote'

/** Облако в памяти: ведёт себя как таблица jp_records с триггером из supabase/schema.sql. */
class FakeRemote implements Remote {
  rows = new Map<string, RemoteRow>()
  offline = false
  onUpsert: (() => Promise<void>) | null = null
  private tick = 0

  async upsert(rows: OutgoingRow[]) {
    if (this.offline) throw new TypeError('Failed to fetch')
    await this.onUpsert?.()
    for (const row of rows) {
      const old = this.rows.get(row.id)
      if (old && row.updated_at < old.updated_at) continue // триггер: устаревшая правка не проходит
      this.rows.set(row.id, { ...row, server_updated_at: this.nextServerTime() })
    }
  }

  async pullSince(since: string | null, limit: number) {
    if (this.offline) throw new TypeError('Failed to fetch')
    return [...this.rows.values()]
      .filter((row) => !since || serverTime(row.server_updated_at) > serverTime(since))
      .sort((a, b) => serverTime(a.server_updated_at) - serverTime(b.server_updated_at))
      .slice(0, limit)
  }

  private nextServerTime() {
    // формат как у Postgres: микросекунды и смещение
    const micros = ++this.tick * 1500
    const base = new Date(Date.UTC(2026, 9, 4) + Math.floor(micros / 1000)).toISOString().slice(0, 19)
    return `${base}.${String(micros % 1_000_000).padStart(6, '0')}+00:00`
  }
}

let n = 0
let remote: FakeRemote
let phone: JapanDB
let laptop: JapanDB

beforeEach(() => {
  n++
  remote = new FakeRemote()
  phone = createDb(`phone-${n}`)
  laptop = createDb(`laptop-${n}`)
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-04T10:00:00Z') })
  setRole('owner')
})

afterEach(async () => {
  vi.useRealTimers()
  await phone.delete()
  await laptop.delete()
})

const later = (ms: number) => vi.setSystemTime(Date.now() + ms)

async function newPlace(db: JapanDB, name = 'Ичиран') {
  return createPlace(db, { ...blankPlace('food'), name, city: 'Токио', station: 'Сибуя' })
}

describe('синхронизация двух устройств', () => {
  it('место с телефона появляется на компьютере', async () => {
    const id = await newPlace(phone)
    const categoryId = await createCategory(phone, 'food', 'Рамен', '🍜')
    await updatePlace(phone, id, { categoryIds: [categoryId] })

    await createSyncEngine(phone, remote).sync()
    await createSyncEngine(laptop, remote).sync()

    expect((await laptop.places.get(id))?.name).toBe('Ичиран')
    expect((await laptop.places.get(id))?.categoryIds).toEqual([categoryId])
    expect((await laptop.categories.get(categoryId))?.name).toBe('Рамен')
    expect(await phone.places.where('dirty').equals(1).count()).toBe(0)
  })

  it('удаление на компьютере доезжает до телефона', async () => {
    const id = await newPlace(phone)
    const phoneSync = createSyncEngine(phone, remote)
    const laptopSync = createSyncEngine(laptop, remote)
    await phoneSync.sync()
    await laptopSync.sync()

    later(1000)
    await deletePlace(laptop, id)
    await laptopSync.sync()
    await phoneSync.sync()

    expect((await phone.places.get(id))?.deleted).toBe(1)
  })

  it('конфликт: побеждает более позднее изменение, на обоих устройствах одинаково', async () => {
    const id = await newPlace(phone)
    const phoneSync = createSyncEngine(phone, remote)
    const laptopSync = createSyncEngine(laptop, remote)
    await phoneSync.sync()
    await laptopSync.sync()

    later(1000)
    await updatePlace(phone, id, { note: 'С телефона' })
    later(1000)
    await updatePlace(laptop, id, { note: 'С компьютера (позже)' })

    await laptopSync.sync() // более поздняя правка уходит первой
    await phoneSync.sync() // более ранняя отвергается сервером, телефон забирает позднюю
    await laptopSync.sync()

    expect((await phone.places.get(id))?.note).toBe('С компьютера (позже)')
    expect((await laptop.places.get(id))?.note).toBe('С компьютера (позже)')
    expect(remote.rows.get(id)?.data.note).toBe('С компьютера (позже)')
  })

  it('без сети: изменения копятся и уходят, когда связь появилась', async () => {
    const engine = createSyncEngine(phone, remote)
    remote.offline = true
    await newPlace(phone)
    await createCategory(phone, 'food', 'Суши', '🍣')

    await engine.sync()
    expect(engine.getState()).toMatchObject({ status: 'offline', pending: 2 })
    expect(remote.rows.size).toBe(0)

    remote.offline = false
    await engine.sync()
    expect(engine.getState()).toMatchObject({ status: 'idle', pending: 0 })
    expect(remote.rows.size).toBe(2)
  })

  it('правка во время отправки не теряется — уйдёт следующей синхронизацией', async () => {
    const id = await newPlace(phone)
    const engine = createSyncEngine(phone, remote)
    remote.onUpsert = async () => {
      remote.onUpsert = null
      later(10)
      await updatePlace(phone, id, { note: 'Изменено во время отправки' })
    }

    await engine.sync()
    expect((await phone.places.get(id))?.dirty).toBe(1)

    await engine.sync()
    expect(remote.rows.get(id)?.data.note).toBe('Изменено во время отправки')
    expect((await phone.places.get(id))?.dirty).toBe(0)
  })

  it('незнакомые записи в облаке пропускаются', async () => {
    remote.rows.set('p1', {
      id: 'p1',
      kind: 'ping',
      data: { text: 'тест' },
      updated_at: 1,
      deleted: false,
      server_updated_at: '2026-10-04T00:42:45.123456+00:00',
    })
    const engine = createSyncEngine(laptop, remote)
    await engine.sync()
    expect(engine.getState().status).toBe('idle')
    expect(await laptop.places.count()).toBe(0)
  })

  it('новый раздел в обновлённом приложении: облако скачивается заново', async () => {
    await newPlace(phone)
    await createCategory(phone, 'food', 'Рамен', '🍜')
    await createSyncEngine(phone, remote).sync()

    const staleState = [
      { key: 'pullCursor', value: '2026-10-04T01:00:00.000000+00:00' },
      { key: 'pullKinds', value: 'place' },
    ]
    await laptop.meta.bulkPut(staleState)
    await createSyncEngine(laptop, remote).sync()
    expect(await laptop.categories.count()).toBe(1)
    expect((await laptop.meta.get('pullKinds'))?.value).toBe(SYNCED_TABLES.map((t) => t.kind).join(','))
  })

  it('зритель: записать нельзя, а скачивать можно', async () => {
    const id = await newPlace(phone)
    await createSyncEngine(phone, remote).sync()

    setRole('viewer')
    await expect(newPlace(laptop, 'Чужое')).rejects.toThrow(/Только просмотр/)
    await expect(updatePlace(laptop, id, { note: 'x' })).rejects.toThrow(/Только просмотр/)
    await expect(deletePlace(laptop, id)).rejects.toThrow(/Только просмотр/)

    await createSyncEngine(laptop, remote).sync()
    expect((await laptop.places.get(id))?.name).toBe('Ичиран')
    expect(await laptop.places.where('dirty').equals(1).count()).toBe(0)
  })
})

describe('serverTime', () => {
  it('сравнивает время сервера с точностью до микросекунд', () => {
    expect(serverTime('2026-10-04T00:42:45.123457+00:00')).toBeGreaterThan(serverTime('2026-10-04T00:42:45.123456+00:00'))
    expect(serverTime('2026-10-04T00:42:45.5+00:00')).toBeGreaterThan(serverTime('2026-10-04T00:42:45.12+00:00'))
    expect(serverTime('2026-10-04T00:42:46+00:00')).toBeGreaterThan(serverTime('2026-10-04T00:42:45.999999+00:00'))
    expect(serverTime('2026-10-04T03:42:45+03:00')).toBe(serverTime('2026-10-04T00:42:45+00:00'))
  })
})
