import { registerSW } from 'virtual:pwa-register'

// Обновление приложения. Значок на экране «Домой» iPhone почти никогда не запускается заново —
// система лишь будит приложение из фона, а браузер ищет новую версию только при запуске.
// Поэтому проверяем сами: при каждом возврате в приложение и раз в полчаса. Найденную версию
// ставим сразу (страница перезагрузится), но не посреди заполнения формы — после выхода из неё.

/** Экраны-формы: перезагрузка на них потеряла бы введённое. */
const EDITING = /^#\/(new|edit|new-item|edit-item|new-guide|edit-guide)(\/|\?|$)/
const CHECK_EVERY_MS = 30 * 60 * 1000

let registration: ServiceWorkerRegistration | undefined
let pending: (() => Promise<void>) | null = null

function applyIfIdle() {
  if (!pending || EDITING.test(location.hash)) return
  const apply = pending
  pending = null
  void apply()
}

export function startUpdates(): void {
  if (!('serviceWorker' in navigator)) return
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      pending = () => updateSW(true)
      applyIfIdle()
    },
    onRegisteredSW(_url, reg) {
      registration = reg
    },
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
  setInterval(() => void checkForUpdate(), CHECK_EVERY_MS)
  window.addEventListener('hashchange', applyIfIdle)
}

/** Спросить сервер о новой версии. true — нашлась и сейчас поставится. */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration || !navigator.onLine) return false
  try {
    await registration.update()
  } catch {
    return false
  }
  return Boolean(registration.installing || registration.waiting || pending)
}
