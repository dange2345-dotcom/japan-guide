import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { photoUrl } from '../config'
import { useRows } from '../data/use-data'
import type { Category, Photo, Place, SectionId } from '../db/types'
import { PRICE_LABELS, sectionInfo } from '../domain/catalog'
import { stationBadge } from '../domain/lines'
import { buildHash, goBack } from '../lib/hooks'
import { SyncPill } from '../ui/components'
import { IconBack, IconInbox, IconSearch, IconSettings, IconStar, IconTrain } from '../ui/icons'

/* ---------- Значки ---------- */

/** Значок линии: кольцо в цвете линии, внутри иероглиф раздела (как значки линий на указателях). */
export function LineBadge(props: { kanji: string; color: string; active?: boolean; size?: number }) {
  const size = props.size ?? 34
  return (
    <span
      class={`line-badge${props.active ? ' line-badge--active' : ''}`}
      style={{ '--line': props.color, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.46)}px` }}
      aria-hidden="true"
      lang="ja"
    >
      {props.kanji}
    </span>
  )
}

/** Номер станции, как на указателях: «G 01» в кольце (метро) или в квадрате (JR). Без номера — пиктограмма поезда. */
export function StationBadge(props: { code?: string; city?: string; size?: 'sm' | 'md' | 'lg' }) {
  const info = stationBadge(props.code, props.city)
  const size = props.size ?? 'sm'
  if (!info) {
    return (
      <span class={`st-badge st-badge--none st-badge--${size}`} aria-hidden="true">
        <IconTrain size={size === 'lg' ? 22 : size === 'md' ? 16 : 13} />
      </span>
    )
  }
  return (
    <span
      class={`st-badge st-badge--${info.shape} st-badge--${size}${info.color ? '' : ' st-badge--unknown'}`}
      style={info.color ? { '--line': info.color } : undefined}
      title={`${info.line}${info.number}`}
    >
      <span class="st-badge__line">{info.line}</span>
      <span class="st-badge__num">{info.number}</span>
    </span>
  )
}

/* ---------- Заголовки ---------- */

/** Поиск, входящие и настройки — в шапке на телефоне (на компьютере они в боковой панели). */
export function HeaderTools() {
  const inbox = useRows('inbox')
  const pending = (inbox ?? []).filter((i) => !i.doneAt).length
  return (
    <div class="head-tools">
      <SyncPill />
      <a class="icon-btn" href={buildHash('search')} aria-label="Поиск">
        <IconSearch />
      </a>
      <a class="icon-btn icon-btn--count mobile-only" href={buildHash('inbox')} aria-label={`Входящие${pending ? `: ${pending}` : ''}`}>
        <IconInbox />
        {pending > 0 && <span class="count-dot num">{pending}</span>}
      </a>
      <a class="icon-btn mobile-only" href={buildHash('settings')} aria-label="Настройки">
        <IconSettings />
      </a>
    </div>
  )
}

/** Заголовок второстепенного экрана: «назад», название, инструменты. */
export function PageHead(props: { title: string; sub?: string; back?: string; actions?: ComponentChildren }) {
  return (
    <header class="page-head">
      {props.back !== undefined && (
        <button class="icon-btn page-head__back" type="button" aria-label="Назад" onClick={() => goBack(buildHash(props.back!))}>
          <IconBack />
        </button>
      )}
      <div class="page-head__text">
        <h1>{props.title}</h1>
        {props.sub && <p class="page-head__sub">{props.sub}</p>}
      </div>
      <div class="page-head__actions">
        {props.actions}
        {props.back === undefined && <HeaderTools />}
      </div>
    </header>
  )
}

/** Табличка платформы: значок линии, название раздела, чтение по-японски и полоса цвета линии. */
export function PlatformSign(props: { kanji: string; title: string; reading: string; color: string; meta?: string }) {
  return (
    <header class="platform" style={{ '--line': props.color }}>
      <div class="platform__row">
        <LineBadge kanji={props.kanji} color={props.color} size={44} />
        <div class="platform__name">
          <h1>{props.title}</h1>
          <p class="platform__reading">
            <span lang="ja">{props.reading}</span>
            {props.meta && <span class="platform__meta"> · {props.meta}</span>}
          </p>
        </div>
        <HeaderTools />
      </div>
      <div class="platform__strip" aria-hidden="true" />
    </header>
  )
}

/* ---------- Фото ---------- */

/** Фото места; нет фото или не загрузилось — табличка с иероглифом раздела. */
export function PlacePhoto(props: { photo: Photo | null; section: SectionId; large?: boolean; alt?: string }) {
  const [failed, setFailed] = useState(false)
  const info = sectionInfo(props.section)
  if (!props.photo || failed) {
    return (
      <div class="photo photo--empty" style={{ '--line': info.color }} aria-hidden="true">
        <span lang="ja">{info.kanji}</span>
      </div>
    )
  }
  return (
    <img
      class="photo"
      src={photoUrl(props.large ? props.photo.path : props.photo.thumb)}
      alt={props.alt ?? ''}
      loading="lazy"
      decoding="async"
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
    />
  )
}

/* ---------- Карточка места ---------- */

export function PlaceCard(props: { place: Place; categories: Map<string, Category>; href: string }) {
  const { place } = props
  const cats = place.categoryIds.map((id) => props.categories.get(id)).filter((c): c is Category => Boolean(c))
  return (
    <a class={`card${place.status === 'been' ? ' card--been' : ''}`} href={props.href} style={{ '--line': sectionInfo(place.section).color }}>
      <div class="card__photo">
        <PlacePhoto photo={place.photo} section={place.section} />
        {place.favorite && (
          <span class="card__fav" aria-label="Избранное">
            <IconStar size={15} filled />
          </span>
        )}
        {place.status === 'been' && <span class="card__been">Был</span>}
      </div>
      <div class="card__body">
        <h3 class="card__name">{place.name}</h3>
        {(place.station || place.stationCode) && (
          <p class="card__station">
            <StationBadge code={place.stationCode} city={place.city} />
            <span class="card__station-name">{place.station || place.stationJa}</span>
          </p>
        )}
        <p class="card__meta">
          <span class="card__cats">{cats.map((c) => c.name).join(' · ') || place.city}</span>
          {place.price > 0 && <span class="card__price num">{PRICE_LABELS[place.price]}</span>}
        </p>
      </div>
    </a>
  )
}
