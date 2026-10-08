import { useEffect, useRef } from 'preact/hooks'
import { useRows } from '../data/use-data'
import { sectionInfo } from '../domain/catalog'
import { normalize, searchPlaces } from '../domain/places'
import { plainExcerpt } from '../domain/markdown'
import { buildHash, navigate } from '../lib/hooks'
import { IconChevronRight } from '../ui/icons'
import { PageHead, PlacePhoto, StationBadge } from './parts'

/** #/search?q=… — по всем разделам и гайдам. */
export function SearchScreen({ params }: { params: URLSearchParams }) {
  const places = useRows('places')
  const categories = useRows('categories')
  const guides = useRows('guides')
  const input = useRef<HTMLInputElement>(null)
  const query = params.get('q') ?? ''

  useEffect(() => input.current?.focus(), [])

  const found = places && categories ? searchPlaces(places, query, categories) : []
  const words = normalize(query).split(' ').filter(Boolean)
  const foundGuides = words.length && guides ? guides.filter((g) => words.every((w) => normalize(`${g.title} ${g.body}`).includes(w))) : []
  const byId = new Map((categories ?? []).map((c) => [c.id, c]))

  return (
    <>
      <PageHead title="Поиск" back="food" />
      <form class="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          ref={input}
          class="search__input"
          type="search"
          enterKeyHint="search"
          placeholder="Название, станция, категория, по-японски…"
          value={query}
          onInput={(e) => navigate(buildHash('search', { q: e.currentTarget.value }), true)}
        />
      </form>

      {words.length > 0 && found.length === 0 && foundGuides.length === 0 && <p class="hint">Ничего не нашлось по «{query}».</p>}

      {found.length > 0 && (
        <ul class="results">
          {found.map((p) => {
            const info = sectionInfo(p.section)
            return (
              <li key={p.id}>
                <a class="result" href={buildHash(`place/${p.id}`)} style={{ '--line': info.color }}>
                  <span class="result__thumb">
                    <PlacePhoto photo={p.photo} section={p.section} />
                  </span>
                  <span class="result__text">
                    <span class="result__name">{p.name}</span>
                    <span class="result__meta">
                      <span class="result__line">{info.title}</span>
                      {p.categoryIds.length > 0 && ` · ${p.categoryIds.map((id) => byId.get(id)?.name).filter(Boolean).join(', ')}`}
                      {p.city && ` · ${p.city}`}
                    </span>
                    {(p.station || p.stationCode) && (
                      <span class="result__station">
                        <StationBadge code={p.stationCode} city={p.city} />
                        {p.station}
                      </span>
                    )}
                  </span>
                  <IconChevronRight size={18} />
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {foundGuides.length > 0 && (
        <section class="guides__topic">
          <h2 class="guides__title">Гайды</h2>
          <ul class="guides__list">
            {foundGuides.map((g) => (
              <li key={g.id}>
                <a class="guide-row" href={buildHash(`guide/${g.id}`)}>
                  <span class="guide-row__text">
                    <span class="guide-row__title">{g.title}</span>
                    <span class="guide-row__excerpt">{plainExcerpt(g.body, 110)}</span>
                  </span>
                  <IconChevronRight size={18} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
