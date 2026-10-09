import { useEffect, useRef, useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { updatePlace } from '../data/records'
import { useRow, useRows } from '../data/use-data'
import type { Category, Place } from '../db/types'
import { PRICE_LABELS, isSection, sectionInfo } from '../domain/catalog'
import { shortUrl } from '../domain/markdown'
import { filterPlaces, mapsLink } from '../domain/places'
import { buildHash, goBack, navigate } from '../lib/hooks'
import { IconBack, IconCheck, IconCopy, IconEdit, IconKana, IconLink, IconMap, IconStar } from '../ui/icons'
import { HeaderTools, PlacePhoto, StationBadge } from './parts'
import { filterParams, readFilter } from './section'

/** #/place/<id>?from=food&cat=…&city=…&st=… — from и фильтр нужны для «соседних станций». */
export function PlaceScreen({ id, params }: { id: string; params: URLSearchParams }) {
  const place = useRow('places', id)
  const places = useRows('places')
  const categories = useRows('categories')

  if (place === undefined || !places || !categories) return null
  if (place === null) {
    return (
      <section class="empty">
        <h2>Места нет</h2>
        <p>Возможно, его удалили на другом устройстве.</p>
        <a class="btn" href={buildHash('food')}>
          К ресторанам
        </a>
      </section>
    )
  }

  // Соседи по тому списку, из которого открыли место (или по всему разделу).
  const from = params.get('from')
  const filter = readFilter(params)
  const list = isSection(from) ? filterPlaces(places, from, filter) : filterPlaces(places, place.section, { category: null, city: null, status: 'all' })
  const index = list.findIndex((p) => p.id === place.id)
  const navParams = isSection(from) ? { from, ...filterParams(filter) } : {}
  const prev = index > 0 ? list[index - 1] : null
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null
  const back = buildHash(isSection(from) ? from : place.section, isSection(from) ? filterParams(filter) : undefined)

  return <PlaceView key={place.id} place={place} categories={categories} prev={prev} next={next} navParams={navParams} back={back} position={index >= 0 ? [index + 1, list.length] : null} />
}

function PlaceView(props: {
  place: Place
  categories: Category[]
  prev: Place | null
  next: Place | null
  navParams: Record<string, string | null>
  back: string
  position: [number, number] | null
}) {
  const { place } = props
  const { db, canEdit } = useApp()
  const [japanese, setJapanese] = useState(false)
  const [copied, setCopied] = useState(false)
  const info = sectionInfo(place.section)
  const cats = place.categoryIds.map((id) => props.categories.find((c) => c.id === id)).filter((c): c is Category => Boolean(c))
  const go = (target: Place | null) => target && navigate(buildHash(`place/${target.id}`, props.navParams), true)

  // Свайп влево/вправо — к соседней станции.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) go(dx < 0 ? props.next : props.prev)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (japanese || (e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft') go(props.prev)
      if (e.key === 'ArrowRight') go(props.next)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(place.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // нет доступа к буферу
    }
  }

  return (
    <article class="place" style={{ '--line': info.color }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div class="place__top">
        <button class="icon-btn icon-btn--float" type="button" aria-label="Назад" onClick={() => goBack(props.back)}>
          <IconBack />
        </button>
        <HeaderTools />
      </div>

      <div class="place__photo">
        <PlacePhoto photo={place.photo} section={place.section} large alt={place.name} />
      </div>

      <section class="board">
        <h1 class="board__name">{place.name}</h1>
        {place.nameJa && (
          <p class="board__ja" lang="ja">
            {place.nameJa}
          </p>
        )}
        <div class="board__status">
          <span class="board__line">
            <span class="board__dot" aria-hidden="true" />
            {info.title}
            {cats.length > 0 && ` · ${cats.map((c) => c.name).join(', ')}`}
          </span>
          {place.status === 'been' && (
            <span class="tag tag--been">
              <IconCheck size={14} /> Был
            </span>
          )}
          {place.favorite && (
            <span class="tag tag--fav">
              <IconStar size={14} filled /> Избранное
            </span>
          )}
        </div>
      </section>

      <div class="place__actions">
        <a class="btn btn--exit btn--block" href={mapsLink(place)} target="_blank" rel="noopener noreferrer">
          <IconMap size={20} />
          Открыть в Google Maps
          <span class="btn__arrow" aria-hidden="true">
            ↗
          </span>
        </a>
        {(place.nameJa || place.stationJa) && (
          <button class="btn btn--block" type="button" onClick={() => setJapanese(true)}>
            <IconKana size={20} />
            Показать по-японски
          </button>
        )}
      </div>

      <dl class="rows">
        {(place.station || place.stationCode) && (
          <div class="rows__item">
            <dt>Станция</dt>
            <dd class="rows__station">
              <StationBadge code={place.stationCode} city={place.city} size="md" />
              <span>
                {place.station}
                {place.stationJa && (
                  <span class="rows__ja" lang="ja">
                    {' '}
                    {place.stationJa}
                  </span>
                )}
              </span>
            </dd>
          </div>
        )}
        {place.city && (
          <div class="rows__item">
            <dt>Город</dt>
            <dd>{place.city}</dd>
          </div>
        )}
        {place.address && (
          <div class="rows__item">
            <dt>Адрес</dt>
            <dd class="rows__copy">
              <span>{place.address}</span>
              <button class="icon-btn" type="button" aria-label="Скопировать адрес" title={copied ? 'Скопировано' : 'Скопировать'} onClick={() => void copyAddress()}>
                {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
              </button>
            </dd>
          </div>
        )}
        {place.hours && (
          <div class="rows__item">
            <dt>Часы</dt>
            <dd>{place.hours}</dd>
          </div>
        )}
        {place.price > 0 && (
          <div class="rows__item">
            <dt>Цена</dt>
            <dd class="num">{PRICE_LABELS[place.price]}</dd>
          </div>
        )}
        {place.note && (
          <div class="rows__item rows__item--note">
            <dt>Заметка</dt>
            <dd>{place.note}</dd>
          </div>
        )}
        {place.sourceUrls.length > 0 && (
          <div class="rows__item">
            <dt>Откуда</dt>
            <dd class="rows__links">
              {place.sourceUrls.map((url) => (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <IconLink size={16} />
                  {sourceLabel(url)}
                </a>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {canEdit && (
        <div class="place__edit">
          <button
            class={`btn${place.status === 'been' ? ' btn--on' : ''}`}
            type="button"
            aria-pressed={place.status === 'been'}
            onClick={() => void updatePlace(db, place.id, { status: place.status === 'been' ? 'want' : 'been' })}
          >
            <IconCheck size={18} />
            {place.status === 'been' ? 'Был' : 'Отметить «был»'}
          </button>
          <button class={`btn${place.favorite ? ' btn--on' : ''}`} type="button" aria-pressed={place.favorite} onClick={() => void updatePlace(db, place.id, { favorite: !place.favorite })}>
            <IconStar size={18} filled={place.favorite} />
            {place.favorite ? 'В избранном' : 'В избранное'}
          </button>
          <a class="btn" href={buildHash(`edit/${place.id}`)}>
            <IconEdit size={18} />
            Изменить
          </a>
        </div>
      )}

      {(props.prev || props.next) && (
        <nav class="next-board" aria-label="Соседние места">
          <div class="next-board__strip" aria-hidden="true" />
          <div class="next-board__row">
            {props.prev ? (
              <a class="next-board__link next-board__link--prev" href={buildHash(`place/${props.prev.id}`, props.navParams)} onClick={(e) => (e.preventDefault(), go(props.prev))}>
                <span class="next-board__dir">← Предыдущее</span>
                <span class="next-board__name">{props.prev.name}</span>
              </a>
            ) : (
              <span />
            )}
            {props.position && (
              <span class="next-board__pos num">
                {props.position[0]}/{props.position[1]}
              </span>
            )}
            {props.next ? (
              <a class="next-board__link next-board__link--next" href={buildHash(`place/${props.next.id}`, props.navParams)} onClick={(e) => (e.preventDefault(), go(props.next))}>
                <span class="next-board__dir">Следующее →</span>
                <span class="next-board__name">{props.next.name}</span>
              </a>
            ) : (
              <span />
            )}
          </div>
        </nav>
      )}

      {japanese && <JapaneseBoard place={place} onClose={() => setJapanese(false)} />}
    </article>
  )
}

export function sourceLabel(url: string): string {
  if (/instagram\.com/i.test(url)) return 'Instagram'
  if (/tiktok\.com/i.test(url)) return 'TikTok'
  if (/youtu\.?be/i.test(url)) return 'YouTube'
  if (/t\.me\//i.test(url)) return 'Telegram'
  return shortUrl(url).slice(0, 40)
}

/** На весь экран, крупно — показать таксисту или персоналу. Нажатие закрывает. */
function JapaneseBoard({ place, onClose }: { place: Place; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  const jaAddress = /[぀-ヿ一-龯]/.test(place.address) ? place.address : ''
  return (
    <div class="ja-board" role="dialog" aria-modal="true" aria-label="По-японски" onClick={onClose} style={{ '--line': sectionInfo(place.section).color }}>
      <div class="ja-board__sign">
        <p class="ja-board__name" lang="ja">
          {place.nameJa || place.name}
        </p>
        {place.stationJa && (
          <p class="ja-board__station" lang="ja">
            最寄り駅：{place.stationJa.replace(/駅$/, "")}駅
          </p>
        )}
        {jaAddress && (
          <p class="ja-board__address" lang="ja">
            {jaAddress}
          </p>
        )}
        <p class="ja-board__ru">{place.name}</p>
      </div>
      <p class="ja-board__hint">Нажмите, чтобы закрыть</p>
    </div>
  )
}
