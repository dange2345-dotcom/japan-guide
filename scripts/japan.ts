// Инструмент для Claude: читать и наполнять «Японию» прямо в облаке (Supabase) секретным ключом.
// Записи пишутся в том же формате, что и приложение, — устройства подхватывают их при следующей синхронизации.
//
//   npm run japan -- setup                       владелец в участники + стартовые категории (повторно — безопасно)
//
//   npm run japan -- places [--section food] [--category <ref>] [--city Токио]
//   npm run japan -- show <ref>
//   npm run japan -- add-place --section food --name "…" [--category Рамен,Изакая] [--city Токио] [--name-ja "…"]
//        [--station "…"] [--station-ja "…"] [--station-code G01] [--address "…"] [--hours "…"] [--price 1-4] [--maps <url>]
//        [--source <url>,<url>] [--note "…"] [--photo <файл|url>] [--status want|been] [--fav]
//   npm run japan -- edit-place <ref> [те же поля] [--photo none] [--no-fav]
//   npm run japan -- delete-place <ref>
//   npm run japan -- import <файл.json> [--yes] [--create-categories]   без --yes — только предпросмотр
//        файл — массив мест или { "places": [...], "items": [...] }
//
//   npm run japan -- items [--status want|note|bought] [--category <ref>]  |  show-item <ref>
//   npm run japan -- add-item --name "…" [--name-ja "…"] [--category Уход,Аптека] [--where "…"] [--shop <ref>,<ref>]
//        [--price "¥1,100"] [--note "…"] [--source <url>,<url>] [--photo <файл|url>] [--status want|note|bought]
//   npm run japan -- edit-item <ref> [те же поля] [--photo none]  |  delete-item <ref>
//
//   npm run japan -- categories [--section food|…|items]
//   npm run japan -- add-category --section food|…|items --name "…" --emoji 🍜
//   npm run japan -- edit-category <ref> [--name "…"] [--emoji …]  |  delete-category <ref>
//
//   npm run japan -- guides  |  show-guide <ref>
//   npm run japan -- add-guide --topic transport|money|connection|documents|etiquette|other --title "…" --file <md>
//   npm run japan -- edit-guide <ref> [--title "…"] [--topic …] [--file <md>]  |  delete-guide <ref>
//
//   npm run japan -- inbox [--all]  |  inbox-add "текст или ссылка"  |  inbox-done <ref> [--undo]
//
//   npm run japan -- members  |  invite --email … --role admin|viewer [--name "…"]
//   npm run japan -- set-role <email> --role admin|viewer  |  remove-member <email>
//
// <ref> — начало id или часть названия (без учёта регистра).
// Ключ: SUPABASE_SECRET_KEY в japan-guide/.env (только на этом компьютере, в git не попадает).

import { parseArgs, type ParseArgsOptionsConfig } from 'node:util'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { PHOTO_BUCKET, SUPABASE_URL } from '../src/config'
import type { Category, CategoryGroup, Guide, GuideTopic, InboxItem, Item, ItemStatus, Photo, Place, PlaceStatus, SectionId, SyncMeta } from '../src/db/types'
import {
  DEFAULT_CATEGORIES,
  GUIDE_TOPICS,
  groupTitle,
  isCategoryGroup,
  isItemStatus,
  isSection,
  isTopic,
  ITEM_STATUSES,
  PRICE_LABELS,
  SECTIONS,
  sectionInfo,
  topicInfo,
} from '../src/domain/catalog'
import { blankItem, compareItems, findDuplicateItem } from '../src/domain/items'
import { normalizeStationCode } from '../src/domain/lines'
import { blankPlace, comparePlaces, findDuplicate, normalize, sectionCategories } from '../src/domain/places'

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  fail('Не найден файл japan-guide/.env')
}
const SECRET = process.env.SUPABASE_SECRET_KEY?.trim()
if (!SECRET?.startsWith('sb_secret_')) fail('В japan-guide/.env нет ключа SUPABASE_SECRET_KEY=sb_secret_…')

const supabase = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } })
const TABLE = 'jp_records'

/* ---------- облако ---------- */

interface Row {
  id: string
  kind: string
  data: Record<string, unknown>
  updated_at: number
  deleted: boolean
}

let ownerCache: string | null = null
async function ownerId(): Promise<string> {
  if (ownerCache) return ownerCache
  const { data } = await supabase.from('jp_members').select('user_id').eq('role', 'owner').limit(1).maybeSingle()
  if (data?.user_id) return (ownerCache = data.user_id as string)
  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) fail(`Не удалось получить пользователей: ${error.message}`)
  const email = process.env.OWNER_EMAIL?.trim()
  const owner = email ? users.users.find((u) => u.email === email) : users.users.length === 1 ? users.users[0] : undefined
  if (!owner) fail('Не удалось определить владельца: укажите OWNER_EMAIL в .env')
  return (ownerCache = owner.id)
}

async function load<T extends SyncMeta>(kind: string, includeDeleted = false): Promise<T[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, kind, data, updated_at, deleted')
      .eq('kind', kind)
      .order('id')
      .range(from, from + 999)
    if (error) fail(`Ошибка чтения (${kind}): ${error.message}`)
    rows.push(...(data as Row[]))
    if (data.length < 1000) break
  }
  return rows
    .filter((row) => includeDeleted || !row.deleted)
    .map((row) => ({ ...row.data, id: row.id, updatedAt: Number(row.updated_at), deleted: row.deleted ? 1 : 0, dirty: 0 }) as unknown as T)
}

async function save<T extends SyncMeta>(kind: string, entity: T, deleted = false) {
  const { id, updatedAt, deleted: _deleted, dirty: _dirty, ...data } = entity
  const { error } = await supabase.from(TABLE).upsert(
    {
      id,
      kind,
      data,
      // Строго позже прошлой версии — иначе сервер (и устройства) посчитают правку устаревшей.
      updated_at: Math.max(Date.now(), (updatedAt ?? 0) + 1),
      deleted,
      created_by: await ownerId(),
    },
    { onConflict: 'id' },
  )
  if (error) fail(`Ошибка записи: ${error.message}`)
}

function newEntity<T extends SyncMeta>(fields: Omit<T, keyof SyncMeta>, id: string = randomUUID()): T {
  return { ...fields, id, updatedAt: 0, deleted: 0, dirty: 0 } as T
}

/* ---------- поиск по ref ---------- */

function findOne<T extends { id: string }>(items: T[], ref: string | undefined, what: string, text: (item: T) => string[]): T {
  if (!ref) fail(`Не указан(а) ${what} (<ref>: начало id или часть названия)`)
  const byId = items.filter((i) => i.id.startsWith(ref))
  if (byId.length === 1) return byId[0]
  const needle = normalize(ref)
  const exact = items.filter((i) => text(i).some((t) => normalize(t) === needle))
  if (exact.length === 1) return exact[0]
  const partial = items.filter((i) => text(i).some((t) => normalize(t).includes(needle)))
  if (partial.length === 1) return partial[0]
  if (partial.length === 0) fail(`Не найдено: ${what} «${ref}»`)
  fail(`Несколько совпадений для «${ref}»:\n${partial.map((i) => `  ${i.id.slice(0, 8)}  ${text(i)[0]}`).join('\n')}`)
}

const placeText = (p: Place) => [p.name, p.nameJa]

/* ---------- фото ---------- */

async function readImage(source: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { headers: { 'User-Agent': 'Mozilla/5.0 (japan-guide script)' } })
    if (!response.ok) fail(`Фото не скачалось (${response.status}): ${source}`)
    return Buffer.from(await response.arrayBuffer())
  }
  try {
    return readFileSync(resolve(source))
  } catch {
    fail(`Нет файла фото: ${source}`)
  }
}

/** Как в приложении: большое ≤1600 px и миниатюра ≤600 px, JPEG. */
async function uploadPhoto(placeId: string, source: string, folder: 'places' | 'items' = 'places'): Promise<Photo> {
  const input = await readImage(source)
  const image = sharp(input, { failOn: 'none' }).rotate()
  const full = await image.clone().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true })
  const thumb = await image.clone().resize(600, 600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()
  const base = `${folder}/${placeId}/${randomUUID()}`
  const photo: Photo = { path: `${base}.jpg`, thumb: `${base}-t.jpg`, w: full.info.width, h: full.info.height }
  for (const [path, data] of [
    [photo.path, full.data],
    [photo.thumb, thumb],
  ] as const) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, data, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
    if (error) fail(`Фото не загрузилось: ${error.message}`)
  }
  return photo
}

async function deletePhoto(photo: Photo | null) {
  if (photo) await supabase.storage.from(PHOTO_BUCKET).remove([photo.path, photo.thumb])
}

/* ---------- разбор полей места ---------- */

const PLACE_OPTIONS = {
  section: { type: 'string' },
  name: { type: 'string' },
  'name-ja': { type: 'string' },
  category: { type: 'string' },
  city: { type: 'string' },
  station: { type: 'string' },
  'station-ja': { type: 'string' },
  'station-code': { type: 'string' },
  address: { type: 'string' },
  hours: { type: 'string' },
  price: { type: 'string' },
  maps: { type: 'string' },
  source: { type: 'string' },
  note: { type: 'string' },
  photo: { type: 'string' },
  status: { type: 'string' },
  fav: { type: 'boolean' },
  'no-fav': { type: 'boolean' },
} as const

type PlaceInput = {
  section?: string
  name?: string
  nameJa?: string
  category?: string | string[]
  city?: string
  station?: string
  stationJa?: string
  stationCode?: string
  address?: string
  hours?: string
  price?: string | number
  maps?: string
  source?: string | string[]
  note?: string
  photo?: string
  status?: string
  fav?: boolean
}

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return (Array.isArray(value) ? value : value.split(',')).map((s) => s.trim()).filter(Boolean)
}

function parsePrice(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const n = typeof value === 'number' ? value : /^¥+$/.test(value) ? value.length : Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 4) fail(`Цена: 0–4 или ¥…¥¥¥¥, а не «${value}»`)
  return n
}

function parseStatus(value: string | undefined): PlaceStatus | undefined {
  if (value === undefined) return undefined
  if (value !== 'want' && value !== 'been') fail('Статус: want или been')
  return value
}

/** Названия категорий → id (в разделе или у товаров). Неизвестные — в missing. */
function resolveCategories(names: string[], section: CategoryGroup, categories: Category[]): { ids: string[]; missing: string[] } {
  const own = categories.filter((c) => c.section === section)
  const ids: string[] = []
  const missing: string[] = []
  for (const name of names) {
    const found = own.find((c) => c.id === name || normalize(c.name) === normalize(name))
    if (found) ids.push(found.id)
    else missing.push(name)
  }
  return { ids, missing }
}

function inputFromArgs(values: Record<string, string | boolean | undefined>): PlaceInput {
  return {
    section: values.section as string | undefined,
    name: values.name as string | undefined,
    nameJa: values['name-ja'] as string | undefined,
    category: values.category as string | undefined,
    city: values.city as string | undefined,
    station: values.station as string | undefined,
    stationJa: values['station-ja'] as string | undefined,
    stationCode: values['station-code'] as string | undefined,
    address: values.address as string | undefined,
    hours: values.hours as string | undefined,
    price: values.price as string | undefined,
    maps: values.maps as string | undefined,
    source: values.source as string | undefined,
    note: values.note as string | undefined,
    photo: values.photo as string | undefined,
    status: values.status as string | undefined,
    fav: values.fav ? true : values['no-fav'] ? false : undefined,
  }
}

/** Применить введённые поля к месту (только заданные). */
function applyInput(place: Place, input: PlaceInput, categoryIds?: string[]): Place {
  const next = { ...place }
  if (input.name !== undefined) next.name = input.name.trim()
  if (input.nameJa !== undefined) next.nameJa = input.nameJa.trim()
  if (categoryIds) next.categoryIds = categoryIds
  if (input.city !== undefined) next.city = input.city.trim()
  if (input.station !== undefined) next.station = input.station.trim()
  if (input.stationJa !== undefined) next.stationJa = input.stationJa.trim()
  if (input.stationCode !== undefined) next.stationCode = normalizeStationCode(input.stationCode)
  if (input.address !== undefined) next.address = input.address.trim()
  if (input.hours !== undefined) next.hours = input.hours.trim()
  const price = parsePrice(input.price)
  if (price !== undefined) next.price = price
  if (input.maps !== undefined) next.mapsUrl = input.maps.trim()
  if (input.source !== undefined) next.sourceUrls = list(input.source)
  if (input.note !== undefined) next.note = input.note.trim()
  const status = parseStatus(input.status)
  if (status) next.status = status
  if (input.fav !== undefined) next.favorite = input.fav
  return next
}

/* ---------- вывод ---------- */

function placeLine(p: Place, categories: Map<string, Category>): string {
  const cats = p.categoryIds.map((id) => categories.get(id)).filter(Boolean).map((c) => `${c!.emoji}${c!.name}`).join(' ')
  const bits = [
    p.favorite ? '★' : ' ',
    p.status === 'been' ? '✓' : ' ',
    p.id.slice(0, 8),
    p.name + (p.nameJa ? ` (${p.nameJa})` : ''),
    cats && `· ${cats}`,
    [p.station && `🚉 ${[p.stationCode, p.station].filter(Boolean).join(' ')}`, p.city].filter(Boolean).join(', '),
    p.price ? PRICE_LABELS[p.price] : '',
    p.photo ? '📷' : '',
  ]
  return bits.filter(Boolean).join('  ')
}

function printPlace(p: Place, categories: Map<string, Category>) {
  const lines: [string, string][] = [
    ['id', p.id],
    ['Раздел', sectionInfo(p.section).title],
    ['Название', p.name],
    ['По-японски', p.nameJa],
    ['Категории', p.categoryIds.map((id) => categories.get(id)?.name ?? `?${id}`).join(', ')],
    ['Город', p.city],
    ['Станция', [p.stationCode, p.station, p.stationJa].filter(Boolean).join(' / ')],
    ['Адрес', p.address],
    ['Часы', p.hours],
    ['Цена', PRICE_LABELS[p.price] ?? ''],
    ['Карта', p.mapsUrl],
    ['Источники', p.sourceUrls.join('\n             ')],
    ['Фото', p.photo ? `${p.photo.path} (${p.photo.w}×${p.photo.h})` : ''],
    ['Статус', `${p.status === 'been' ? 'был' : 'хочу'}${p.favorite ? ', избранное' : ''}`],
    ['Заметка', p.note],
  ]
  for (const [label, value] of lines) if (value) console.log(`${label.padEnd(11)}  ${value}`)
}

/* ---------- товары («Что купить») ---------- */

const ITEM_OPTIONS = {
  name: { type: 'string' },
  'name-ja': { type: 'string' },
  category: { type: 'string' },
  where: { type: 'string' },
  shop: { type: 'string' },
  price: { type: 'string' },
  note: { type: 'string' },
  source: { type: 'string' },
  photo: { type: 'string' },
  status: { type: 'string' },
} as const

type ItemInput = {
  name?: string
  nameJa?: string
  category?: string | string[]
  where?: string
  /** Магазины из «Шопинга»: начало id или название. */
  shops?: string | string[]
  price?: string
  note?: string
  source?: string | string[]
  photo?: string
  status?: string
}

const itemText = (i: Item) => [i.name, i.nameJa]

function parseItemStatus(value: string | undefined): ItemStatus | undefined {
  if (value === undefined) return undefined
  if (!isItemStatus(value)) fail('Статус товара: want, note или bought')
  return value
}

function itemInputFromArgs(values: Record<string, string | boolean | undefined>): ItemInput {
  return {
    name: values.name as string | undefined,
    nameJa: values['name-ja'] as string | undefined,
    category: values.category as string | undefined,
    where: values.where as string | undefined,
    shops: values.shop as string | undefined,
    price: values.price as string | undefined,
    note: values.note as string | undefined,
    source: values.source as string | undefined,
    photo: values.photo as string | undefined,
    status: values.status as string | undefined,
  }
}

/** Магазины по ссылкам (id или название) среди мест; ненайденные — в missing. */
function resolveShops(refs: string[], places: Place[]): { ids: string[]; missing: string[] } {
  const ids: string[] = []
  const missing: string[] = []
  for (const ref of refs) {
    const needle = normalize(ref)
    const found =
      places.find((p) => p.id.startsWith(ref)) ??
      places.find((p) => placeText(p).some((t) => normalize(t) === needle)) ??
      places.filter((p) => p.section === 'shop' && placeText(p).some((t) => normalize(t).includes(needle))).at(0)
    if (found) ids.push(found.id)
    else missing.push(ref)
  }
  return { ids, missing }
}

function applyItemInput(item: Item, input: ItemInput, categoryIds?: string[], shopIds?: string[]): Item {
  const next = { ...item }
  if (input.name !== undefined) next.name = input.name.trim()
  if (input.nameJa !== undefined) next.nameJa = input.nameJa.trim()
  if (categoryIds) next.categoryIds = categoryIds
  if (shopIds) next.shopIds = shopIds
  if (input.where !== undefined) next.where = input.where.trim()
  if (input.price !== undefined) next.price = input.price.trim()
  if (input.note !== undefined) next.note = input.note.trim()
  if (input.source !== undefined) next.sourceUrls = list(input.source)
  const status = parseItemStatus(input.status)
  if (status) next.status = status
  return next
}

const ITEM_MARK: Record<ItemStatus, string> = { want: '•', note: '¿', bought: '✓' }

function itemLine(i: Item, categories: Map<string, Category>, places: Map<string, Place>): string {
  const cats = i.categoryIds.map((id) => categories.get(id)).filter(Boolean).map((c) => `${c!.emoji}${c!.name}`).join(' ')
  const shops = i.shopIds.map((id) => places.get(id)?.name).filter(Boolean)
  const bits = [
    ITEM_MARK[i.status],
    i.id.slice(0, 8),
    i.name + (i.nameJa ? ` (${i.nameJa})` : ''),
    cats && `· ${cats}`,
    [i.where, ...shops.map((n) => `🛍 ${n}`)].filter(Boolean).join(', '),
    i.price,
    i.photo ? '📷' : '',
  ]
  return bits.filter(Boolean).join('  ')
}

function printItem(i: Item, categories: Map<string, Category>, places: Map<string, Place>) {
  const lines: [string, string][] = [
    ['id', i.id],
    ['Название', i.name],
    ['По-японски', i.nameJa],
    ['Статус', ITEM_STATUSES.find((s) => s.id === i.status)?.label ?? i.status],
    ['Категории', i.categoryIds.map((id) => categories.get(id)?.name ?? `?${id}`).join(', ')],
    ['Что это', i.note],
    ['Где купить', i.where],
    ['Магазины', i.shopIds.map((id) => places.get(id)?.name ?? `?${id}`).join(', ')],
    ['Цена', i.price],
    ['Источники', i.sourceUrls.join('\n             ')],
    ['Фото', i.photo ? `${i.photo.path} (${i.photo.w}×${i.photo.h})` : ''],
  ]
  for (const [label, value] of lines) if (value) console.log(`${label.padEnd(11)}  ${value}`)
}

/* ---------- команды ---------- */

const [command, ...rest] = process.argv.slice(2)

function args<T extends ParseArgsOptionsConfig>(options: T) {
  return parseArgs<{ args: string[]; options: T; allowPositionals: true; strict: true }>({ args: rest, options, allowPositionals: true, strict: true })
}

switch (command) {
  case 'setup': {
    const owner = await ownerId()
    const { data: user } = await supabase.auth.admin.getUserById(owner)
    const { error } = await supabase
      .from('jp_members')
      .upsert({ user_id: owner, email: user.user?.email ?? '', role: 'owner' }, { onConflict: 'user_id' })
    if (error) fail(`Не удалось записать владельца: ${error.message}`)
    console.log(`✔ Владелец: ${user.user?.email ?? owner}`)

    const existing = await load<Category>('category', true)
    const known = new Set(existing.map((c) => c.id))
    let order = existing.reduce((max, c) => Math.max(max, c.order), 0)
    let added = 0
    for (const def of DEFAULT_CATEGORIES) {
      if (known.has(def.id)) continue
      await save('category', newEntity<Category>({ section: def.section, name: def.name, emoji: def.emoji, order: ++order }, def.id))
      added++
    }
    console.log(`✔ Категории: добавлено ${added}, уже было ${DEFAULT_CATEGORIES.length - added}`)
    break
  }

  case 'places': {
    const { values } = args({ section: { type: 'string' }, category: { type: 'string' }, city: { type: 'string' } })
    const [places, categories] = await Promise.all([load<Place>('place'), load<Category>('category')])
    const byId = new Map(categories.map((c) => [c.id, c]))
    if (values.section && !isSection(values.section)) fail(`Раздел: ${SECTIONS.map((s) => s.id).join(', ')}`)
    const category = values.category ? findOne(categories, values.category, 'категория', (c) => [c.name]) : null
    const filtered = places
      .filter((p) => !values.section || p.section === values.section)
      .filter((p) => !category || p.categoryIds.includes(category.id))
      .filter((p) => !values.city || normalize(p.city) === normalize(values.city))
      .sort(comparePlaces)
    for (const section of SECTIONS) {
      const inSection = filtered.filter((p) => p.section === section.id)
      if (inSection.length === 0) continue
      console.log(`\n${section.emoji} ${section.title} — ${inSection.length}`)
      for (const p of inSection) console.log('  ' + placeLine(p, byId))
    }
    if (filtered.length === 0) console.log('Мест нет')
    else console.log(`\nВсего: ${filtered.length} (★ избранное, ✓ был)`)
    break
  }

  case 'show': {
    const [places, categories] = await Promise.all([load<Place>('place'), load<Category>('category')])
    printPlace(findOne(places, rest[0], 'место', placeText), new Map(categories.map((c) => [c.id, c])))
    break
  }

  case 'add-place': {
    const { values } = args(PLACE_OPTIONS)
    const input = inputFromArgs(values)
    if (!input.section || !isSection(input.section)) fail(`--section: ${SECTIONS.map((s) => s.id).join(', ')}`)
    if (!input.name?.trim()) fail('Нужно --name')
    const [places, categories] = await Promise.all([load<Place>('place'), load<Category>('category')])
    const { ids, missing } = resolveCategories(list(input.category), input.section, categories)
    if (missing.length) fail(`Нет таких категорий в разделе: ${missing.join(', ')} (npm run japan -- categories)`)
    const dup = findDuplicate(places, { section: input.section, name: input.name, city: input.city ?? '', mapsUrl: input.maps ?? '' })
    if (dup) fail(`Похоже, уже есть: ${dup.name} (${dup.id.slice(0, 8)}) — правьте через edit-place`)
    const id = randomUUID()
    let place = applyInput(newEntity<Place>(blankPlace(input.section), id), input, ids)
    if (input.photo) place = { ...place, photo: await uploadPhoto(id, input.photo) }
    await save('place', place)
    console.log(`✔ Добавлено: ${placeLine(place, new Map(categories.map((c) => [c.id, c])))}`)
    break
  }

  case 'edit-place': {
    const { values, positionals } = args(PLACE_OPTIONS)
    const [places, categories] = await Promise.all([load<Place>('place'), load<Category>('category')])
    const place = findOne(places, positionals[0], 'место', placeText)
    const input = inputFromArgs(values)
    let section = place.section
    if (input.section !== undefined) {
      if (!isSection(input.section)) fail(`--section: ${SECTIONS.map((s) => s.id).join(', ')}`)
      section = input.section
    }
    let categoryIds: string[] | undefined
    if (input.category !== undefined) {
      const { ids, missing } = resolveCategories(list(input.category), section, categories)
      if (missing.length) fail(`Нет таких категорий в разделе: ${missing.join(', ')}`)
      categoryIds = ids
    } else if (section !== place.section) {
      categoryIds = [] // категории другого раздела не подходят
    }
    let next = { ...applyInput(place, input, categoryIds), section }
    if (input.photo === 'none') {
      await deletePhoto(place.photo)
      next = { ...next, photo: null }
    } else if (input.photo) {
      const photo = await uploadPhoto(place.id, input.photo)
      await deletePhoto(place.photo)
      next = { ...next, photo }
    }
    await save('place', next)
    console.log(`✔ Изменено: ${placeLine(next, new Map(categories.map((c) => [c.id, c])))}`)
    break
  }

  case 'delete-place': {
    const places = await load<Place>('place')
    const place = findOne(places, rest[0], 'место', placeText)
    await deletePhoto(place.photo)
    await save('place', place, true)
    console.log(`✔ Удалено: ${place.name}`)
    break
  }

  case 'import': {
    const { values, positionals } = args({ yes: { type: 'boolean' }, 'create-categories': { type: 'boolean' } })
    if (!positionals[0]) fail('Нужен файл: npm run japan -- import <файл.json>')
    let items: PlaceInput[]
    let goods: ItemInput[]
    try {
      const parsed = JSON.parse(readFileSync(resolve(positionals[0]), 'utf8'))
      items = Array.isArray(parsed) ? parsed : (parsed.places ?? [])
      goods = Array.isArray(parsed) ? [] : (parsed.items ?? [])
      if (!Array.isArray(items) || !Array.isArray(goods)) throw new Error('ожидался массив мест или { places: [...], items: [...] }')
    } catch (error) {
      fail(`Не удалось прочитать ${positionals[0]}: ${error instanceof Error ? error.message : error}`)
    }
    const [places, categories, existingItems] = await Promise.all([load<Place>('place'), load<Category>('category'), load<Item>('item')])
    const known = [...places]
    const plan: { input: PlaceInput; section: SectionId; ids: string[]; missing: string[] }[] = []
    const skipped: string[] = []
    const problems: string[] = []
    for (const [index, input] of items.entries()) {
      const label = `#${index + 1} ${input.name ?? '(без названия)'}`
      if (!input.section || !isSection(input.section)) {
        problems.push(`${label}: раздел «${input.section}» — нужен ${SECTIONS.map((s) => s.id).join('/')}`)
        continue
      }
      if (!input.name?.trim()) {
        problems.push(`${label}: нет названия`)
        continue
      }
      const probe = { section: input.section, name: input.name, city: input.city ?? '', mapsUrl: input.maps ?? '' }
      const dup = findDuplicate(known, probe)
      if (dup) {
        skipped.push(`${input.name} — уже есть «${dup.name}»`)
        continue
      }
      known.push({ ...blankPlace(input.section), ...probe, nameJa: input.nameJa ?? '', id: `new-${index}`, updatedAt: 0, deleted: 0, dirty: 0 })
      plan.push({ input, section: input.section, ...resolveCategories(list(input.category), input.section, categories) })
    }

    // Товары: дубли — по названию (рус./яп.), магазины — среди мест, в том числе новых из этого же файла.
    const knownItems: Pick<Item, 'name' | 'nameJa'>[] = [...existingItems]
    const itemPlan: { input: ItemInput; ids: string[]; missing: string[]; shops: string[]; missingShops: string[] }[] = []
    for (const [index, input] of goods.entries()) {
      if (!input.name?.trim()) {
        problems.push(`товар #${index + 1}: нет названия`)
        continue
      }
      if (input.status !== undefined && !isItemStatus(input.status)) {
        problems.push(`${input.name}: статус «${input.status}» — нужен want/note/bought`)
        continue
      }
      const dup = findDuplicateItem(knownItems, { name: input.name, nameJa: input.nameJa ?? '' })
      if (dup) {
        skipped.push(`${input.name} — уже есть товар «${dup.name}»`)
        continue
      }
      knownItems.push({ name: input.name, nameJa: input.nameJa ?? '' })
      const shops = resolveShops(list(input.shops), known)
      itemPlan.push({ input, ...resolveCategories(list(input.category), 'items', categories), shops: shops.ids, missingShops: shops.missing })
    }

    const missingCats = new Map<string, { section: CategoryGroup; name: string }>()
    for (const p of plan) for (const name of p.missing) missingCats.set(`${p.section}:${normalize(name)}`, { section: p.section, name })
    for (const p of itemPlan) for (const name of p.missing) missingCats.set(`items:${normalize(name)}`, { section: 'items', name })

    for (const section of SECTIONS) {
      const inSection = plan.filter((p) => p.section === section.id)
      if (inSection.length === 0) continue
      console.log(`\n${section.emoji} ${section.title} — ${inSection.length}`)
      for (const { input, ids, missing } of inSection) {
        const cats = [...ids.map((id) => categories.find((c) => c.id === id)!.name), ...missing.map((m) => `${m}*`)].join(', ')
        console.log(`  + ${input.name}${input.city ? ` · ${input.city}` : ''}${input.station ? ` · 🚉 ${input.station}` : ''}${cats ? ` · ${cats}` : ''}${input.photo ? ' · 📷' : ''}`)
      }
    }
    if (itemPlan.length) {
      console.log(`\n🛒 Что купить — ${itemPlan.length}`)
      for (const status of ITEM_STATUSES) {
        const inStatus = itemPlan.filter((p) => (p.input.status ?? 'want') === status.id)
        if (inStatus.length === 0) continue
        console.log(`  ${status.label} — ${inStatus.length}`)
        for (const { input, ids, missing, shops, missingShops } of inStatus) {
          const cats = [...ids.map((id) => categories.find((c) => c.id === id)!.name), ...missing.map((m) => `${m}*`)].join(', ')
          const shopNames = [...shops.map((id) => known.find((p) => p.id === id)?.name), ...missingShops.map((m) => `${m}?`)].filter(Boolean)
          console.log(
            `    + ${input.name}${input.nameJa ? ` (${input.nameJa})` : ''}${cats ? ` · ${cats}` : ''}${shopNames.length ? ` · 🛍 ${shopNames.join(', ')}` : ''}${input.price ? ` · ${input.price}` : ''}${input.photo ? ' · 📷' : ''}`,
          )
        }
      }
      const lost = itemPlan.flatMap((p) => p.missingShops)
      if (lost.length) console.log(`  ? Магазины не найдены (товары запишутся без них): ${[...new Set(lost)].join(', ')}`)
    }
    if (skipped.length) console.log(`\nПропущены (дубли) — ${skipped.length}:\n  ${skipped.join('\n  ')}`)
    if (problems.length) console.log(`\nОшибки — ${problems.length}:\n  ${problems.join('\n  ')}`)
    if (missingCats.size) {
      console.log(`\n* Новые категории: ${[...missingCats.values()].map((c) => `${groupTitle(c.section)}/${c.name}`).join(', ')}`)
      if (!values['create-categories']) console.log('  (создать — флаг --create-categories, иначе записи будут без этих категорий)')
    }
    if (!values.yes) {
      console.log(`\nПредпросмотр. Записать мест: ${plan.length}, товаров: ${itemPlan.length} — добавьте --yes`)
      break
    }

    const allCategories = [...categories]
    if (values['create-categories']) {
      let order = categories.reduce((max, c) => Math.max(max, c.order), 0)
      for (const { section, name } of missingCats.values()) {
        const category = newEntity<Category>({ section, name: name.trim(), emoji: section === 'items' ? '🛍️' : '📍', order: ++order })
        await save('category', category)
        allCategories.push(category)
      }
    }
    let done = 0
    const created: Place[] = []
    for (const { input, section } of plan) {
      const { ids } = resolveCategories(list(input.category), section, allCategories)
      const id = randomUUID()
      let place = applyInput(newEntity<Place>(blankPlace(section), id), input, ids)
      if (input.photo) {
        try {
          place = { ...place, photo: await uploadPhoto(id, input.photo) }
        } catch {
          console.log(`  ! фото не загрузилось: ${input.name}`)
        }
      }
      await save('place', place)
      created.push(place)
      done++
    }
    let doneItems = 0
    for (const { input } of itemPlan) {
      const { ids } = resolveCategories(list(input.category), 'items', allCategories)
      const { ids: shopIds } = resolveShops(list(input.shops), [...places, ...created])
      const id = randomUUID()
      let item = applyItemInput(newEntity<Item>(blankItem(), id), input, ids, shopIds)
      if (input.photo) {
        try {
          item = { ...item, photo: await uploadPhoto(id, input.photo, 'items') }
        } catch {
          console.log(`  ! фото не загрузилось: ${input.name}`)
        }
      }
      await save('item', item)
      doneItems++
    }
    console.log(`\n✔ Записано мест: ${done}, товаров: ${doneItems}`)
    break
  }

  case 'items': {
    const { values } = args({ status: { type: 'string' }, category: { type: 'string' } })
    const status = parseItemStatus(values.status)
    const [items, categories, places] = await Promise.all([load<Item>('item'), load<Category>('category'), load<Place>('place')])
    const category = values.category ? findOne(categories.filter((c) => c.section === 'items'), values.category, 'категория', (c) => [c.name]) : null
    const filtered = items.filter((i) => (!status || i.status === status) && (!category || i.categoryIds.includes(category.id))).sort(compareItems)
    const byId = new Map(categories.map((c) => [c.id, c]))
    const placeById = new Map(places.map((p) => [p.id, p]))
    for (const s of ITEM_STATUSES) {
      const inStatus = filtered.filter((i) => i.status === s.id)
      if (inStatus.length === 0) continue
      console.log(`\n${s.label} — ${inStatus.length}`)
      for (const i of inStatus) console.log('  ' + itemLine(i, byId, placeById))
    }
    console.log(filtered.length ? `\nВсего: ${filtered.length} (• купить, ¿ на заметку, ✓ куплено)` : 'Товаров нет')
    break
  }

  case 'show-item': {
    const [items, categories, places] = await Promise.all([load<Item>('item'), load<Category>('category'), load<Place>('place')])
    printItem(findOne(items, rest[0], 'товар', itemText), new Map(categories.map((c) => [c.id, c])), new Map(places.map((p) => [p.id, p])))
    break
  }

  case 'add-item':
  case 'edit-item': {
    const { values, positionals } = args(ITEM_OPTIONS)
    const input = itemInputFromArgs(values)
    const [items, categories, places] = await Promise.all([load<Item>('item'), load<Category>('category'), load<Place>('place')])
    let categoryIds: string[] | undefined
    if (input.category !== undefined) {
      const { ids, missing } = resolveCategories(list(input.category), 'items', categories)
      if (missing.length) fail(`Нет таких категорий товаров: ${missing.join(', ')} (npm run japan -- categories --section items)`)
      categoryIds = ids
    }
    let shopIds: string[] | undefined
    if (input.shops !== undefined) {
      const { ids, missing } = resolveShops(list(input.shops), places)
      if (missing.length) fail(`Не найдены магазины: ${missing.join(', ')}`)
      shopIds = ids
    }
    const byId = new Map(categories.map((c) => [c.id, c]))
    const placeById = new Map(places.map((p) => [p.id, p]))
    if (command === 'add-item') {
      if (!input.name?.trim()) fail('Нужно --name')
      const dup = findDuplicateItem(items, { name: input.name, nameJa: input.nameJa ?? '' })
      if (dup) fail(`Похоже, уже есть: ${dup.name} (${dup.id.slice(0, 8)}) — правьте через edit-item`)
      const id = randomUUID()
      let item = applyItemInput(newEntity<Item>(blankItem(), id), input, categoryIds, shopIds)
      if (input.photo) item = { ...item, photo: await uploadPhoto(id, input.photo, 'items') }
      await save('item', item)
      console.log(`✔ Добавлено: ${itemLine(item, byId, placeById)}`)
    } else {
      const item = findOne(items, positionals[0], 'товар', itemText)
      let next = applyItemInput(item, input, categoryIds, shopIds)
      if (input.photo === 'none') {
        await deletePhoto(item.photo)
        next = { ...next, photo: null }
      } else if (input.photo) {
        const photo = await uploadPhoto(item.id, input.photo, 'items')
        await deletePhoto(item.photo)
        next = { ...next, photo }
      }
      await save('item', next)
      console.log(`✔ Изменено: ${itemLine(next, byId, placeById)}`)
    }
    break
  }

  case 'delete-item': {
    const item = findOne(await load<Item>('item'), rest[0], 'товар', itemText)
    await deletePhoto(item.photo)
    await save('item', item, true)
    console.log(`✔ Удалено: ${item.name}`)
    break
  }

  case 'categories': {
    const { values } = args({ section: { type: 'string' } })
    const [categories, places, items] = await Promise.all([load<Category>('category'), load<Place>('place'), load<Item>('item')])
    const groups: { id: CategoryGroup; title: string }[] = [...SECTIONS.map((s) => ({ id: s.id, title: `${s.emoji} ${s.title}` })), { id: 'items', title: `🛒 ${groupTitle('items')}` }]
    for (const group of groups) {
      if (values.section && values.section !== group.id) continue
      console.log(`\n${group.title} (${group.id})`)
      const rows: { categoryIds: string[] }[] = group.id === 'items' ? items : places
      for (const c of sectionCategories(categories, group.id)) {
        const n = rows.filter((r) => r.categoryIds.includes(c.id)).length
        console.log(`  ${c.id.slice(0, 18).padEnd(18)}  ${c.emoji} ${c.name}${n ? `  — ${n}` : ''}`)
      }
    }
    break
  }

  case 'add-category': {
    const { values } = args({ section: { type: 'string' }, name: { type: 'string' }, emoji: { type: 'string' } })
    if (!values.section || !isCategoryGroup(values.section)) fail(`--section: ${SECTIONS.map((s) => s.id).join(', ')}, items`)
    if (!values.name?.trim()) fail('Нужно --name')
    const categories = await load<Category>('category')
    if (categories.some((c) => c.section === values.section && normalize(c.name) === normalize(values.name!))) fail('Такая категория уже есть')
    const order = categories.reduce((max, c) => Math.max(max, c.order), 0) + 1
    await save('category', newEntity<Category>({ section: values.section, name: values.name.trim(), emoji: values.emoji?.trim() || '📍', order }))
    console.log(`✔ Категория: ${values.emoji ?? '📍'} ${values.name} (${groupTitle(values.section)})`)
    break
  }

  case 'edit-category': {
    const { values, positionals } = args({ name: { type: 'string' }, emoji: { type: 'string' } })
    const categories = await load<Category>('category')
    const category = findOne(categories, positionals[0], 'категория', (c) => [c.name])
    const next = { ...category, ...(values.name ? { name: values.name.trim() } : {}), ...(values.emoji ? { emoji: values.emoji.trim() } : {}) }
    await save('category', next)
    console.log(`✔ Категория: ${next.emoji} ${next.name}`)
    break
  }

  case 'delete-category': {
    const [categories, places, items] = await Promise.all([load<Category>('category'), load<Place>('place'), load<Item>('item')])
    const category = findOne(categories, rest[0], 'категория', (c) => [c.name])
    const affected = places.filter((p) => p.categoryIds.includes(category.id))
    for (const p of affected) await save('place', { ...p, categoryIds: p.categoryIds.filter((id) => id !== category.id) })
    const affectedItems = items.filter((i) => i.categoryIds.includes(category.id))
    for (const i of affectedItems) await save('item', { ...i, categoryIds: i.categoryIds.filter((id) => id !== category.id) })
    await save('category', category, true)
    console.log(`✔ Удалена категория ${category.name}; убрана у мест: ${affected.length}, у товаров: ${affectedItems.length}`)
    break
  }

  case 'guides': {
    const guides = await load<Guide>('guide')
    for (const topic of GUIDE_TOPICS) {
      const inTopic = guides.filter((g) => g.topic === topic.id).sort((a, b) => a.order - b.order)
      if (inTopic.length === 0) continue
      console.log(`\n${topic.emoji} ${topic.title}`)
      for (const g of inTopic) console.log(`  ${g.id.slice(0, 8)}  ${g.title}  (${g.body.length} знаков)`)
    }
    if (guides.length === 0) console.log('Гайдов нет')
    break
  }

  case 'show-guide': {
    const guide = findOne(await load<Guide>('guide'), rest[0], 'гайд', (g) => [g.title])
    console.log(`# ${guide.title}  [${topicInfo(guide.topic).title}, ${guide.id}]\n\n${guide.body}`)
    break
  }

  case 'add-guide':
  case 'edit-guide': {
    const { values, positionals } = args({ topic: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' } })
    if (values.topic && !isTopic(values.topic)) fail(`--topic: ${GUIDE_TOPICS.map((t) => t.id).join(', ')}`)
    const body = values.file ? readFileSync(resolve(values.file), 'utf8').replace(/\r\n/g, '\n').trim() : undefined
    const guides = await load<Guide>('guide')
    if (command === 'add-guide') {
      if (!values.title?.trim()) fail('Нужно --title')
      const order = guides.reduce((max, g) => Math.max(max, g.order), 0) + 1
      const guide = newEntity<Guide>({ topic: (values.topic as GuideTopic) ?? 'other', title: values.title.trim(), body: body ?? '', order })
      await save('guide', guide)
      console.log(`✔ Гайд: ${guide.title} (${topicInfo(guide.topic).title})`)
    } else {
      const guide = findOne(guides, positionals[0], 'гайд', (g) => [g.title])
      const next: Guide = {
        ...guide,
        ...(values.title ? { title: values.title.trim() } : {}),
        ...(values.topic ? { topic: values.topic as GuideTopic } : {}),
        ...(body !== undefined ? { body } : {}),
      }
      await save('guide', next)
      console.log(`✔ Гайд изменён: ${next.title}`)
    }
    break
  }

  case 'delete-guide': {
    const guide = findOne(await load<Guide>('guide'), rest[0], 'гайд', (g) => [g.title])
    await save('guide', guide, true)
    console.log(`✔ Удалён гайд: ${guide.title}`)
    break
  }

  case 'inbox': {
    const { values } = args({ all: { type: 'boolean' } })
    const items = (await load<InboxItem>('inbox')).filter((i) => values.all || !i.doneAt).sort((a, b) => a.createdAt - b.createdAt)
    for (const i of items) {
      const date = new Date(i.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      console.log(`${i.doneAt ? '✓' : '•'} ${i.id.slice(0, 8)}  ${date}  ${i.text}`)
    }
    if (items.length === 0) console.log(values.all ? 'Входящих нет' : 'Неразобранных нет')
    break
  }

  case 'inbox-add': {
    const text = rest.join(' ').trim()
    if (!text) fail('Нужен текст')
    await save('inbox', newEntity<InboxItem>({ text, createdAt: Date.now(), doneAt: null }))
    console.log('✔ Во входящих')
    break
  }

  case 'inbox-done': {
    const { values, positionals } = args({ undo: { type: 'boolean' } })
    const item = findOne(await load<InboxItem>('inbox'), positionals[0], 'запись', (i) => [i.text])
    await save('inbox', { ...item, doneAt: values.undo ? null : Date.now() })
    console.log(values.undo ? '✔ Снова ждёт разбора' : '✔ Разобрано')
    break
  }

  case 'members': {
    const { data, error } = await supabase.from('jp_members').select('email, name, role, added_at').order('added_at')
    if (error) fail(error.message)
    const label = { owner: 'владелец', admin: 'администратор', viewer: 'зритель' } as Record<string, string>
    for (const m of data) console.log(`${(label[m.role] ?? m.role).padEnd(14)} ${m.email}${m.name ? ` (${m.name})` : ''}`)
    break
  }

  case 'invite': {
    const { values } = args({ email: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' } })
    const email = values.email?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Нужно --email')
    if (values.role !== 'admin' && values.role !== 'viewer') fail('--role admin|viewer')
    const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) fail(error.message)
    let user = users.users.find((u) => u.email?.toLowerCase() === email)
    let password: string | null = null
    if (!user) {
      password = randomBytes(9).toString('base64url')
      const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { invited_to: 'japan' } })
      if (created.error) fail(created.error.message)
      user = created.data.user
    }
    const { data: existing } = await supabase.from('jp_members').select('role').eq('user_id', user.id).maybeSingle()
    if (existing?.role === 'owner') fail('Это владелец')
    const { error: upsertError } = await supabase
      .from('jp_members')
      .upsert({ user_id: user.id, email, name: values.name?.trim() ?? '', role: values.role }, { onConflict: 'user_id' })
    if (upsertError) fail(upsertError.message)
    console.log(`✔ ${email} — ${values.role === 'admin' ? 'администратор' : 'зритель'}`)
    // Пароль нужен владельцу, чтобы передать человеку; в лог не сохраняется.
    if (password) console.log(`  Временный пароль (передать человеку, он сменит в настройках): ${password}`)
    break
  }

  case 'set-role':
  case 'remove-member': {
    const { values, positionals } = args({ role: { type: 'string' } })
    const email = positionals[0]?.trim().toLowerCase()
    if (!email) fail('Нужна почта участника')
    const { data: member } = await supabase.from('jp_members').select('user_id, role').eq('email', email).maybeSingle()
    if (!member) fail(`Нет участника ${email}`)
    if (member.role === 'owner') fail('Владельца не трогаем')
    if (command === 'remove-member') {
      const { error } = await supabase.from('jp_members').delete().eq('user_id', member.user_id)
      if (error) fail(error.message)
      console.log(`✔ ${email} больше не участник`)
    } else {
      if (values.role !== 'admin' && values.role !== 'viewer') fail('--role admin|viewer')
      const { error } = await supabase.from('jp_members').update({ role: values.role }).eq('user_id', member.user_id)
      if (error) fail(error.message)
      console.log(`✔ ${email} — ${values.role}`)
    }
    break
  }

  default:
    fail(
      'Команды: setup, places, show, add-place, edit-place, delete-place, import, items, show-item, add-item, edit-item, delete-item, ' +
        'categories, add-category, edit-category, delete-category, ' +
        'guides, show-guide, add-guide, edit-guide, delete-guide, inbox, inbox-add, inbox-done, members, invite, set-role, remove-member',
    )
}
