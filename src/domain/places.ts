import type { Branch, Category, CategoryGroup, Place, SectionId } from '../db/types'

// Фильтр, поиск, сортировка и проверка дублей. Общие для приложения и scripts/japan.ts.

export type StatusFilter = 'all' | 'want' | 'been' | 'fav'

export interface PlaceFilter {
  /** null — все категории. */
  category: string | null
  /** null — все города. */
  city: string | null
  status: StatusFilter
}

export const NO_FILTER: PlaceFilter = { category: null, city: null, status: 'all' }

/** Для поиска и сравнения: регистр, «ё», лишние пробелы не важны. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

/** Города места: свой и городов его точек (сеть может быть и в Токио, и в Осаке). */
export function placeCities(place: Pick<Place, 'city' | 'branches'>): string[] {
  const seen = new Map<string, string>()
  for (const city of [place.city, ...(place.branches ?? []).map((b) => b.city)]) {
    const key = normalize(city)
    if (key && !seen.has(key)) seen.set(key, city.trim())
  }
  return [...seen.values()]
}

export function matchesFilter(place: Place, filter: PlaceFilter): boolean {
  if (filter.category && !place.categoryIds.includes(filter.category)) return false
  if (filter.city && !placeCities(place).some((city) => normalize(city) === normalize(filter.city!))) return false
  if (filter.status === 'want' && place.status !== 'want') return false
  if (filter.status === 'been' && place.status !== 'been') return false
  if (filter.status === 'fav' && !place.favorite) return false
  return true
}

/** Избранное сверху, посещённое вниз, внутри — по алфавиту. */
export function comparePlaces(a: Place, b: Place): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
  if (a.status !== b.status) return a.status === 'been' ? 1 : -1
  return a.name.localeCompare(b.name, 'ru')
}

export function filterPlaces(places: Place[], section: SectionId, filter: PlaceFilter): Place[] {
  return places.filter((p) => p.section === section && matchesFilter(p, filter)).sort(comparePlaces)
}

/** Поиск по всем разделам: название (рус. и яп.), станция, город, адрес, заметка — и станции, адреса точек сети. */
export function searchPlaces(places: Place[], query: string, categories: Category[] = []): Place[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  return places
    .filter((p) => {
      const branches = (p.branches ?? []).flatMap((b) => [b.name ?? '', b.nameJa, b.station, b.stationJa, b.city, b.address])
      const haystack = normalize(
        [p.name, p.nameJa, p.station, p.stationJa, p.city, p.address, p.note, ...branches, ...p.categoryIds.map((id) => categoryName.get(id) ?? '')].join(' '),
      )
      return words.every((word) => haystack.includes(word))
    })
    .sort(comparePlaces)
}

/** Города раздела по числу мест (больше — раньше). */
export function citiesOf(places: Place[], section?: SectionId): string[] {
  const counts = new Map<string, { name: string; n: number }>()
  for (const p of places) {
    if (section && p.section !== section) continue
    for (const city of placeCities(p)) {
      const key = normalize(city)
      const entry = counts.get(key) ?? { name: city, n: 0 }
      entry.n++
      counts.set(key, entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'ru')).map((e) => e.name)
}

/** Сколько мест в каждой категории (с учётом города и статуса, без учёта выбранной категории). */
export function categoryCounts(places: Place[], section: SectionId, filter: PlaceFilter): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of places) {
    if (p.section !== section || !matchesFilter(p, { ...filter, category: null })) continue
    for (const id of p.categoryIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Категории раздела (или товаров) по порядку. */
export function sectionCategories(categories: Category[], section: CategoryGroup): Category[] {
  return categories.filter((c) => c.section === section).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru'))
}

/* ---------- ссылки Google Maps и дубли ---------- */

const KEEP_PARAMS = ['q', 'query', 'query_place_id', 'place_id', 'cid', 'ftid']

/** Ссылка Google Maps без мусора (масштаб, координаты вида, метки отслеживания) — чтобы сравнивать. */
export function normalizeMapsUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  // У филиалов сети в ссылке одно название («/place/Gyu-Kaku/…»), различает их только id места в data=…!1s0x…:0x…
  const featureId = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(trimmed)?.[1]
  if (featureId) return `maps-place:${featureId.toLowerCase()}`
  try {
    const u = new URL(trimmed)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    // /maps/place/Name/@35.6,139.7,17z/data=… → /maps/place/name
    const path = decodeURIComponent(u.pathname)
      .replace(/\/@.*$/, '')
      .replace(/\/data=.*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
    const params = KEEP_PARAMS.filter((k) => u.searchParams.has(k)).map((k) => `${k}=${u.searchParams.get(k)}`)
    return `${host}${path}${params.length ? '?' + params.join('&') : ''}`
  } catch {
    return trimmed.toLowerCase()
  }
}

export interface DuplicateProbe {
  section: SectionId
  name: string
  city: string
  mapsUrl: string
  branches?: Pick<Branch, 'mapsUrl'>[]
}

/** Ссылки места и всех его точек — для сравнения. */
function mapsUrlsOf(p: Pick<DuplicateProbe, 'mapsUrl' | 'branches'>): string[] {
  return [p.mapsUrl, ...(p.branches ?? []).map((b) => b.mapsUrl)].map(normalizeMapsUrl).filter(Boolean)
}

/** Уже есть такое место? Совпала ссылка Maps (в том числе у точки сети) — или раздел и название, а города совпадают либо где-то не указаны. */
export function findDuplicate<T extends DuplicateProbe>(existing: T[], probe: DuplicateProbe): T | undefined {
  const urls = mapsUrlsOf(probe)
  const name = normalize(probe.name)
  const city = normalize(probe.city)
  return existing.find((p) => {
    if (urls.length && mapsUrlsOf(p).some((u) => urls.includes(u))) return true
    if (p.section !== probe.section || normalize(p.name) !== name) return false
    const otherCity = normalize(p.city)
    return !city || !otherCity || city === otherCity
  })
}

/** Ссылка «открыть в Google Maps»: своя, если есть, иначе поиск по японскому названию (или русскому) и городу.
 *  У сети — поиск по названию сети: Карты сами покажут ближайшие точки. */
export function mapsLink(place: Pick<Place, 'mapsUrl' | 'name' | 'nameJa' | 'city' | 'address' | 'branches'>): string {
  if (place.branches?.length) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.nameJa || place.name)}`
  if (place.mapsUrl.trim()) return place.mapsUrl.trim()
  const query = [place.nameJa || place.name, place.address || place.city].filter(Boolean).join(' ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Пустое место со значениями по умолчанию — основа для формы, импорта и CLI. */
export function blankPlace(section: SectionId): Omit<Place, 'id' | 'updatedAt' | 'deleted' | 'dirty'> {
  return {
    section,
    categoryIds: [],
    city: '',
    name: '',
    nameJa: '',
    station: '',
    stationJa: '',
    stationCode: '',
    address: '',
    hours: '',
    price: 0,
    mapsUrl: '',
    sourceUrls: [],
    photo: null,
    note: '',
    status: 'want',
    favorite: false,
    createdAt: Date.now(),
  }
}
