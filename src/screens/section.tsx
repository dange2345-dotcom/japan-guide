import { useEffect, useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { useRows } from '../data/use-data'
import type { SectionId } from '../db/types'
import { sectionInfo } from '../domain/catalog'
import { categoryCounts, citiesOf, filterPlaces, sectionCategories, type PlaceFilter, type StatusFilter } from '../domain/places'
import { plural } from '../lib/plural'
import { buildHash, navigate } from '../lib/hooks'
import { EmptyState } from '../ui/components'
import { IconEdit, IconPlus, IconStar } from '../ui/icons'
import { CategoriesSheet } from './categories-sheet'
import { PlaceCard, PlatformSign } from './parts'

const STATUS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'want', label: 'Хочу' },
  { id: 'been', label: 'Был' },
  { id: 'fav', label: 'Избранное' },
]

function StatusLabel({ id, label }: { id: StatusFilter; label: string }) {
  return id === 'fav' ? <IconStar size={17} filled /> : <>{label}</>
}

const EMPTY_TITLE: Record<SectionId, string> = {
  food: 'Пока ни одного ресторана',
  fun: 'Пока ни одного места',
  shop: 'Пока ни одного магазина',
  hotel: 'Пока ни одного отеля',
}

/** Фильтр раздела живёт в адресе (#/food?cat=…&city=…&st=…) — «Назад» из места возвращает к нему. */
export function readFilter(params: URLSearchParams): PlaceFilter {
  const st = params.get('st')
  return {
    category: params.get('cat'),
    city: params.get('city'),
    status: st === 'want' || st === 'been' || st === 'fav' ? st : 'all',
  }
}

export function filterParams(filter: PlaceFilter): Record<string, string | null> {
  return { cat: filter.category, city: filter.city, st: filter.status === 'all' ? null : filter.status }
}

export function SectionScreen({ section, params }: { section: SectionId; params: URLSearchParams }) {
  const { canEdit } = useApp()
  const places = useRows('places')
  const categories = useRows('categories')
  const [editing, setEditing] = useState(false)
  const info = sectionInfo(section)
  const filter = readFilter(params)

  const setFilter = (next: Partial<PlaceFilter>) => navigate(buildHash(section, filterParams({ ...filter, ...next })), true)

  useListScroll(Boolean(places && categories))

  if (!places || !categories) return null

  const inSection = places.filter((p) => p.section === section)
  const cats = sectionCategories(categories, section)
  const counts = categoryCounts(places, section, filter)
  const cities = citiesOf(places, section)
  const list = filterPlaces(places, section, filter)
  const byId = new Map(categories.map((c) => [c.id, c]))
  const detailParams = { from: section, ...filterParams(filter) }
  const filtered = filter.category || filter.city || filter.status !== 'all'

  return (
    <>
      <PlatformSign
        kanji={info.kanji}
        title={info.title}
        reading={info.reading}
        color={info.color}
        meta={`${inSection.length} ${plural(inSection.length, 'место', 'места', 'мест')}`}
      />

      <nav class="rail" aria-label="Категории" style={{ '--line': info.color }}>
        <div class="rail__scroll">
          <button type="button" class={`chip${filter.category === null ? ' chip--on' : ''}`} aria-pressed={filter.category === null} onClick={() => setFilter({ category: null })}>
            Все
          </button>
          {cats.map((c) => {
            const on = filter.category === c.id
            const n = counts.get(c.id) ?? 0
            return (
              <button type="button" class={`chip${on ? ' chip--on' : ''}${n === 0 && !on ? ' chip--empty' : ''}`} aria-pressed={on} onClick={() => setFilter({ category: on ? null : c.id })}>
                <span class="chip__mark" aria-hidden="true">
                  {c.emoji}
                </span>
                {c.name}
                {n > 0 && <span class="chip__count num">{n}</span>}
              </button>
            )
          })}
          {canEdit && (
            <button type="button" class="chip chip--tool" onClick={() => setEditing(true)} aria-label="Изменить категории">
              <IconEdit size={15} />
            </button>
          )}
        </div>
      </nav>

      <div class="filters">
        {cities.length > 1 && (
          <label class="select-wrap">
            <span class="visually-hidden">Город</span>
            <select class="select" value={filter.city ?? ''} onChange={(e) => setFilter({ city: e.currentTarget.value || null })}>
              <option value="">Все города</option>
              {cities.map((c) => (
                <option value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <div class="segmented segmented--compact" role="radiogroup" aria-label="Статус">
          {STATUS.map((s) => (
            <button
              type="button"
              role="radio"
              aria-checked={filter.status === s.id}
              class={`segmented__item${filter.status === s.id ? ' segmented__item--on' : ''}`}
              onClick={() => setFilter({ status: s.id })}
              aria-label={s.label}
              title={s.label}
            >
              <StatusLabel id={s.id} label={s.label} />
            </button>
          ))}
        </div>
      </div>

      {inSection.length === 0 ? (
        <EmptyState title={EMPTY_TITLE[section]} text="Добавьте сами или попросите Claude перенести из Notion, Google Maps и Plotline.">
          {canEdit && (
            <a class="btn btn--exit" href={buildHash('new', { section })}>
              <IconPlus size={18} />
              Добавить
            </a>
          )}
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState title="Ничего не нашлось" text={filtered ? 'С такими фильтрами мест нет.' : undefined}>
          <button class="btn" type="button" onClick={() => navigate(buildHash(section), true)}>
            Сбросить фильтры
          </button>
        </EmptyState>
      ) : (
        <div class="grid" key={`${filter.category}|${filter.city}|${filter.status}`}>
          {list.map((place) => (
            <PlaceCard key={place.id} place={place} categories={byId} href={buildHash(`place/${place.id}`, detailParams)} />
          ))}
        </div>
      )}

      {canEdit && (
        <a
          class="fab"
          href={buildHash('new', { section, cat: filter.category, city: filter.city })}
          aria-label={`Добавить: ${info.one}`}
          title={`Новый ${info.one}`}
        >
          <IconPlus size={26} />
        </a>
      )}

      {editing && <CategoriesSheet section={section} onClose={() => setEditing(false)} />}
    </>
  )
}

/** Запомнить, где был список, и вернуться туда после «Назад» из места. */
function useListScroll(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const key = `jp:scroll:${location.hash}`
    try {
      const saved = Number(sessionStorage.getItem(key))
      if (saved > 0) requestAnimationFrame(() => window.scrollTo(0, saved))
    } catch {
      // нет доступа к хранилищу
    }
    const save = () => {
      try {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)))
      } catch {
        // нет доступа к хранилищу
      }
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      save()
      window.removeEventListener('scroll', save)
    }
  }, [ready, location.hash])
}
