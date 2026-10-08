import { liveQuery } from 'dexie'
import { useEffect, useState } from 'preact/hooks'
import type { SyncEngine, SyncState } from '../sync/engine'

/** Живой запрос к локальной базе: компонент перерисовывается при любом изменении затронутых данных. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (next) => setValue(() => next),
      error: (error) => console.error(error),
    })
    return () => subscription.unsubscribe()
  }, deps)
  return value
}

export function useSyncState(engine: SyncEngine): SyncState {
  const [state, setState] = useState(engine.getState())
  useEffect(() => engine.subscribe(setState), [engine])
  return state
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/* ---------- адрес экрана в hash: #/food?cat=…&city=… ---------- */

export interface Route {
  /** «food», «place/<id>», «settings»… */
  path: string
  params: URLSearchParams
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const q = raw.indexOf('?')
  return q === -1 ? { path: raw, params: new URLSearchParams() } : { path: raw.slice(0, q), params: new URLSearchParams(raw.slice(q + 1)) }
}

export function buildHash(path: string, params?: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) if (value) query.set(key, value)
  const qs = query.toString()
  return `#/${path}${qs ? '?' + qs : ''}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

/** Перейти на экран. replace — без новой записи в истории (смена фильтра). */
export function navigate(hash: string, replace = false): void {
  if (replace) location.replace(hash)
  else location.hash = hash
}

/** «Назад»: по истории, если пришли изнутри приложения, иначе — на запасной экран. */
export function goBack(fallback: string): void {
  let inside = false
  try {
    inside = sessionStorage.getItem('jp:navigated') === '1'
  } catch {
    // нет доступа к хранилищу
  }
  if (inside && history.length > 1) history.back()
  else navigate(fallback, true)
}

/** Отмечаем, что внутри приложения уже были переходы (чтобы «Назад» не вывел из приложения). */
export function trackNavigation(): void {
  window.addEventListener('hashchange', () => {
    try {
      sessionStorage.setItem('jp:navigated', '1')
    } catch {
      // нет доступа к хранилищу — «Назад» будет вести на запасной экран
    }
  })
}
