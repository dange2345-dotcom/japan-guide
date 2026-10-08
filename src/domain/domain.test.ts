import { describe, expect, it } from 'vitest'
import type { Place } from '../db/types'
import { DEFAULT_CATEGORIES, SECTIONS } from './catalog'
import { normalizeStationCode, stationBadge } from './lines'
import { parseInline, parseMarkdown, plainExcerpt } from './markdown'
import {
  blankPlace,
  categoryCounts,
  citiesOf,
  filterPlaces,
  findDuplicate,
  mapsLink,
  NO_FILTER,
  normalizeMapsUrl,
  searchPlaces,
} from './places'

let n = 0
function place(fields: Partial<Place>): Place {
  return { ...blankPlace('food'), id: `p${++n}`, updatedAt: 1, deleted: 0, dirty: 0, ...fields }
}

const ichiran = place({ name: 'Ичиран', nameJa: '一蘭', city: 'Токио', station: 'Сибуя', categoryIds: ['ramen'] })
const afuri = place({ name: 'Afuri', city: 'Токио', categoryIds: ['ramen'], status: 'been' })
const gyukatsu = place({ name: 'Гюкацу Мотомура', city: 'Осака', categoryIds: ['tonkatsu'], favorite: true })
const kinkaku = place({ section: 'fun', name: 'Кинкаку-дзи', city: 'Киото', categoryIds: ['temple'] })
const all = [ichiran, afuri, gyukatsu, kinkaku]

describe('фильтр мест', () => {
  it('без выбранной категории — все места раздела', () => {
    expect(filterPlaces(all, 'food', NO_FILTER).map((p) => p.name)).toEqual(['Гюкацу Мотомура', 'Ичиран', 'Afuri'])
  })

  it('категория оставляет только свои места', () => {
    expect(filterPlaces(all, 'food', { ...NO_FILTER, category: 'ramen' }).map((p) => p.name)).toEqual(['Ичиран', 'Afuri'])
    expect(filterPlaces(all, 'food', { ...NO_FILTER, category: 'temple' })).toEqual([])
  })

  it('категория, город и статус работают вместе', () => {
    expect(filterPlaces(all, 'food', { category: 'ramen', city: 'токио', status: 'want' }).map((p) => p.name)).toEqual(['Ичиран'])
    expect(filterPlaces(all, 'food', { category: null, city: null, status: 'been' }).map((p) => p.name)).toEqual(['Afuri'])
    expect(filterPlaces(all, 'food', { category: null, city: null, status: 'fav' }).map((p) => p.name)).toEqual(['Гюкацу Мотомура'])
  })

  it('избранное сверху, посещённое внизу', () => {
    const list = filterPlaces(all, 'food', NO_FILTER)
    expect(list[0].favorite).toBe(true)
    expect(list[list.length - 1].status).toBe('been')
  })

  it('счётчики категорий учитывают город, но не выбранную категорию', () => {
    const counts = categoryCounts(all, 'food', { category: 'tonkatsu', city: 'Токио', status: 'all' })
    expect(counts.get('ramen')).toBe(2)
    expect(counts.get('tonkatsu')).toBeUndefined()
  })

  it('города — по числу мест', () => {
    expect(citiesOf(all)).toEqual(['Токио', 'Киото', 'Осака'])
    expect(citiesOf(all, 'fun')).toEqual(['Киото'])
  })
})

describe('поиск', () => {
  it('ищет по названию, японскому названию, станции и категории; ё = е', () => {
    expect(searchPlaces(all, 'сибуя').map((p) => p.name)).toEqual(['Ичиран'])
    expect(searchPlaces(all, '一蘭').map((p) => p.name)).toEqual(['Ичиран'])
    expect(searchPlaces(all, 'тонкацу', [{ id: 'tonkatsu', name: 'Тонкацу', section: 'food', emoji: '', order: 1, updatedAt: 0, deleted: 0, dirty: 0 }]).map((p) => p.name)).toEqual([
      'Гюкацу Мотомура',
    ])
    expect(searchPlaces([place({ name: 'Ёсинoя' })], 'есин')).toHaveLength(1)
    expect(searchPlaces(all, '   ')).toEqual([])
  })
})

describe('ссылки Google Maps и дубли', () => {
  it('ссылки на одно место сравниваются без масштаба и меток', () => {
    const a = 'https://www.google.com/maps/place/Ichiran+Shibuya/@35.661,139.700,17z/data=!3m1!4b1?entry=ttu'
    const b = 'https://google.com/maps/place/Ichiran+Shibuya/@35.6612,139.7001,19z'
    expect(normalizeMapsUrl(a)).toBe(normalizeMapsUrl(b))
    expect(normalizeMapsUrl('https://maps.google.com/?cid=123&hl=ru')).toBe('maps.google.com?cid=123')
    expect(normalizeMapsUrl('https://maps.app.goo.gl/AbC/')).toBe('maps.app.goo.gl/abc')
  })

  it('дубль: та же ссылка — или то же название в том же разделе и городе', () => {
    const withUrl = place({ name: 'Ichiran', mapsUrl: 'https://maps.app.goo.gl/x1' })
    expect(findDuplicate([withUrl], { section: 'food', name: 'Другое', city: '', mapsUrl: 'https://maps.app.goo.gl/x1/' })).toBe(withUrl)
    expect(findDuplicate(all, { section: 'food', name: 'ичиран', city: 'Токио', mapsUrl: '' })).toBe(ichiran)
    expect(findDuplicate(all, { section: 'food', name: 'Ичиран', city: '', mapsUrl: '' })).toBe(ichiran)
    expect(findDuplicate(all, { section: 'food', name: 'Ичиран', city: 'Фукуока', mapsUrl: '' })).toBeUndefined()
    expect(findDuplicate(all, { section: 'shop', name: 'Ичиран', city: 'Токио', mapsUrl: '' })).toBeUndefined()
  })

  it('без своей ссылки — поиск по японскому названию и городу', () => {
    expect(mapsLink(ichiran)).toBe('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('一蘭 Токио'))
    expect(mapsLink({ ...ichiran, mapsUrl: ' https://maps.app.goo.gl/x ' })).toBe('https://maps.app.goo.gl/x')
  })
})

describe('каталог', () => {
  it('у стартовых категорий уникальные id и разделы из списка', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const sections = new Set(SECTIONS.map((s) => s.id))
    expect(DEFAULT_CATEGORIES.every((c) => sections.has(c.section))).toBe(true)
  })
})

describe('markdown гайдов', () => {
  it('разбирает заголовки, списки, чек-листы, таблицы и цитаты', () => {
    const blocks = parseMarkdown(
      [
        '# JR Pass',
        'Стоит **50 000 ¥** на 7 дней.',
        '',
        '- [x] Купить онлайн',
        '- [ ] Активировать',
        '',
        '1. Первый',
        '2. Второй',
        '',
        '| Билет | Цена |',
        '|---|---:|',
        '| 7 дней | 50 000 |',
        '',
        '> Не окупается для Токио',
        '---',
      ].join('\n'),
    )
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'table', 'quote', 'rule'])
    const checklist = blocks[2]
    expect(checklist.type === 'list' && checklist.items.map((i) => i.checked)).toEqual([true, false])
    const table = blocks[4]
    expect(table.type === 'table' && table.rows.length).toBe(1)
  })

  it('ссылки: только http(s), mailto, tel — остальное текстом', () => {
    expect(parseInline('[сайт](https://jrpass.com)')).toEqual([{ type: 'link', href: 'https://jrpass.com', children: [{ type: 'text', text: 'сайт' }] }])
    expect(parseInline('[злое](javascript:alert(1))')[0]).toMatchObject({ type: 'text' })
    expect(parseInline('см. https://www.japan-guide.com/e/e2361.html.')).toEqual([
      { type: 'text', text: 'см. ' },
      { type: 'link', href: 'https://www.japan-guide.com/e/e2361.html', children: [{ type: 'text', text: 'japan-guide.com/e/e2361.html' }] },
      { type: 'text', text: '.' },
    ])
  })

  it('превью без разметки', () => {
    expect(plainExcerpt('# Заголовок\n- **Жирно** и [ссылка](https://a.b)')).toBe('Заголовок Жирно и ссылка')
  })
})

describe('номера станций', () => {
  it('приводит запись к виду с указателей', () => {
    expect(normalizeStationCode('g-1')).toBe('G01')
    expect(normalizeStationCode(' jy 20 ')).toBe('JY20')
    expect(normalizeStationCode('Сибуя')).toBe('СИБУЯ')
  })

  it('цвет линии: Токио по умолчанию, Осака по городу, JR — квадрат', () => {
    expect(stationBadge('G01')).toEqual({ line: 'G', number: '01', color: '#f39700', shape: 'circle' })
    expect(stationBadge('M20', 'Осака')?.color).toBe('#e5171f')
    expect(stationBadge('M16', 'Токио')?.color).toBe('#e60012')
    expect(stationBadge('JY20')).toMatchObject({ shape: 'square', color: '#80c241' })
    expect(stationBadge('Q05')).toMatchObject({ color: null })
    expect(stationBadge('')).toBeNull()
    expect(stationBadge('Сибуя')).toBeNull()
  })
})
