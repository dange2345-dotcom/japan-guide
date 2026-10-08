import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { useApp } from '../app-context'
import { useSyncState } from '../lib/hooks'
import { IconClose } from './icons'

/** Панель поверх экрана: на телефоне выезжает снизу, на компьютере — по центру. */
export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  // Через ref, чтобы эффект не перезапускался на каждой перерисовке (иначе фокус уходил бы из полей ввода).
  const onClose = useRef(props.onClose)
  onClose.current = props.onClose

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose.current()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div class="sheet-backdrop" onClick={(event) => event.target === event.currentTarget && props.onClose()}>
      <div class={`sheet${props.wide ? ' sheet--wide' : ''}`} role="dialog" aria-modal="true" aria-label={props.title} tabIndex={-1} ref={panel}>
        <div class="sheet__head">
          <h2>{props.title}</h2>
          <button type="button" class="icon-btn" onClick={props.onClose} aria-label="Закрыть">
            <IconClose size={20} />
          </button>
        </div>
        <div class="sheet__body">{props.children}</div>
      </div>
    </div>
  )
}

export function SyncPill() {
  const { sync } = useApp()
  const state = useSyncState(sync)
  const { tone, text } = syncLabel(state.status, state.pending)
  return (
    <button type="button" class={`sync-pill sync-pill--${tone}`} onClick={() => void sync.sync()} title="Синхронизировать сейчас">
      <span class="sync-pill__dot" aria-hidden="true" />
      <span class="sync-pill__text">{text}</span>
    </button>
  )
}

export function syncLabel(status: string, pending: number): { tone: 'ok' | 'busy' | 'warn' | 'error'; text: string } {
  switch (status) {
    case 'syncing':
      return { tone: 'busy', text: 'Синхронизация…' }
    case 'offline':
      return { tone: 'warn', text: pending ? `Нет сети · ${pending}` : 'Нет сети' }
    case 'error':
      return { tone: 'error', text: 'Ошибка синхр.' }
    default:
      return pending ? { tone: 'busy', text: 'Сохраняю…' } : { tone: 'ok', text: 'Синхронизировано' }
  }
}

export function EmptyState(props: { title: string; text?: string; children?: ComponentChildren }) {
  return (
    <section class="empty">
      <h2>{props.title}</h2>
      {props.text && <p>{props.text}</p>}
      {props.children}
    </section>
  )
}

/** Подпись + поле. */
export function Field(props: { label: string; hint?: string; children: ComponentChildren; wide?: boolean }) {
  return (
    <label class={`field${props.wide ? ' field--wide' : ''}`}>
      <span class="field__label">{props.label}</span>
      {props.children}
      {props.hint && <span class="field__hint">{props.hint}</span>}
    </label>
  )
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p class="error" role="alert">
      {error}
    </p>
  ) : null
}
