import { useEffect, useRef } from 'preact/hooks'
import { useRows } from '../data/use-data'
import type { SectionId } from '../db/types'
import { GUIDES_LINE, SECTIONS, isSection } from '../domain/catalog'
import { buildHash, useRoute } from '../lib/hooks'
import { IconInbox, IconSearch, IconSettings } from '../ui/icons'
import { GuideFormScreen } from './guide-form'
import { GuideScreen, GuidesScreen } from './guides'
import { InboxScreen } from './inbox'
import { LineBadge } from './parts'
import { PlaceScreen } from './place'
import { PlaceFormScreen } from './place-form'
import { SearchScreen } from './search'
import { SectionScreen } from './section'
import { SettingsScreen } from './settings'

const TABS = [
  ...SECTIONS.map((s) => ({ route: s.id as string, title: s.title, kanji: s.kanji, color: s.color })),
  { route: 'guides', title: GUIDES_LINE.title, kanji: GUIDES_LINE.kanji, color: GUIDES_LINE.color },
]

/** Какая вкладка подсвечена: раздел места, гайды для статей, иначе — ничего. */
function activeTab(path: string, params: URLSearchParams, placeSection: SectionId | null): string | null {
  const [head] = path.split('/')
  if (isSection(head) || head === 'guides') return head
  if (head === 'guide' || head === 'new-guide' || head === 'edit-guide') return 'guides'
  if (head === 'place' || head === 'edit') return placeSection ?? params.get('from')
  if (head === 'new') return params.get('section') ?? 'food'
  return null
}

export function Shell() {
  const { path, params } = useRoute()
  const [head, id] = path.split('/')
  const places = useRows('places')
  const inbox = useRows('inbox')
  const pending = (inbox ?? []).filter((i) => !i.doneAt).length
  const placeSection = (head === 'place' || head === 'edit') && id ? (places?.find((p) => p.id === id)?.section ?? null) : null
  const current = activeTab(path, params, placeSection)

  // Новый экран — с начала; смена фильтра (тот же path) прокрутку не трогает.
  const lastPath = useRef(path)
  useEffect(() => {
    if (lastPath.current !== path) window.scrollTo(0, 0)
    lastPath.current = path
  }, [path])

  let screen
  if (isSection(head)) screen = <SectionScreen section={head} params={params} />
  else if (head === 'place' && id) screen = <PlaceScreen id={id} params={params} />
  else if (head === 'new') screen = <PlaceFormScreen params={params} />
  else if (head === 'edit' && id) screen = <PlaceFormScreen placeId={id} params={params} />
  else if (head === 'guides') screen = <GuidesScreen params={params} />
  else if (head === 'guide' && id) screen = <GuideScreen id={id} />
  else if (head === 'new-guide') screen = <GuideFormScreen params={params} />
  else if (head === 'edit-guide' && id) screen = <GuideFormScreen guideId={id} params={params} />
  else if (head === 'search') screen = <SearchScreen params={params} />
  else if (head === 'inbox') screen = <InboxScreen />
  else if (head === 'settings') screen = <SettingsScreen />
  else screen = <SectionScreen section="food" params={params} />

  return (
    <div class="shell">
      <nav class="lines" aria-label="Разделы">
        <a class="lines__brand desktop-only" href={buildHash('food')}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={30} height={30} />
          <span>Япония</span>
        </a>
        <div class="lines__route">
          <span class="lines__track" aria-hidden="true" />
          {TABS.map((tab) => {
            const on = current === tab.route
            return (
              <a href={buildHash(tab.route)} class={`line-tab${on ? ' line-tab--on' : ''}`} aria-current={on ? 'page' : undefined} style={{ '--line': tab.color }}>
                <LineBadge kanji={tab.kanji} color={tab.color} active={on} />
                <span class="line-tab__label">{tab.title}</span>
              </a>
            )
          })}
        </div>
        <div class="lines__tools desktop-only">
          <a class={`rail-link${head === 'search' ? ' rail-link--on' : ''}`} href={buildHash('search')}>
            <IconSearch size={20} />
            Поиск
          </a>
          <a class={`rail-link${head === 'inbox' ? ' rail-link--on' : ''}`} href={buildHash('inbox')}>
            <IconInbox size={20} />
            Входящие
            {pending > 0 && <span class="rail-link__count num">{pending}</span>}
          </a>
          <a class={`rail-link${head === 'settings' ? ' rail-link--on' : ''}`} href={buildHash('settings')}>
            <IconSettings size={20} />
            Настройки
          </a>
        </div>
      </nav>

      <main class={`main${head === 'place' ? ' main--place' : ''}`} key={head === 'place' ? 'place' : path}>
        {screen}
      </main>
    </div>
  )
}
