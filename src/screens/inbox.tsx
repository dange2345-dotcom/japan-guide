import { useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { addInbox, deleteInbox, setInboxDone } from '../data/records'
import { useRows } from '../data/use-data'
import type { InboxItem } from '../db/types'
import { parseInline } from '../domain/markdown'
import { buildHash, navigate } from '../lib/hooks'
import { EmptyState } from '../ui/components'
import { IconCheck, IconPlus, IconTrash } from '../ui/icons'
import { InlineText } from '../ui/markdown'
import { PageHead } from './parts'

const URL_RE = /https?:\/\/[^\s<>()]+/

export function InboxScreen() {
  const { db, canEdit } = useApp()
  const items = useRows('inbox')
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(false)

  const pending = (items ?? []).filter((i) => !i.doneAt).sort((a, b) => b.createdAt - a.createdAt)
  const done = (items ?? []).filter((i) => i.doneAt).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))

  async function save(event: Event) {
    event.preventDefault()
    if (!text.trim()) return
    await addInbox(db, text)
    setText('')
  }

  async function paste() {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) setText((t) => (t ? `${t} ${clip}` : clip))
    } catch {
      // нет доступа к буферу — вставят вручную
    }
  }

  return (
    <>
      <PageHead title="Входящие" sub="Ссылки и заметки, которые ещё не разобраны по местам" />

      {canEdit && (
        <form class="inbox-add" onSubmit={save}>
          <textarea
            class="inbox-add__input"
            rows={3}
            placeholder="Ссылка на рилс, пост или просто название места"
            value={text}
            onInput={(e) => setText(e.currentTarget.value)}
          />
          <div class="row-actions">
            {'clipboard' in navigator && (
              <button class="btn btn--ghost" type="button" onClick={() => void paste()}>
                Вставить из буфера
              </button>
            )}
            <button class="btn btn--primary" type="submit" disabled={!text.trim()}>
              <IconPlus size={18} />
              Сохранить
            </button>
          </div>
        </form>
      )}

      {items && pending.length === 0 && (
        <EmptyState title="Всё разобрано" text="Увидели место в соцсетях — сохраните ссылку сюда, а разберёте потом сами или попросите Claude." />
      )}

      <ul class="inbox-list">
        {pending.map((item) => (
          <InboxRow key={item.id} item={item} />
        ))}
      </ul>

      {done.length > 0 && (
        <section class="inbox-done">
          <button class="btn btn--ghost btn--small" type="button" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {showDone ? 'Скрыть разобранные' : `Разобранные · ${done.length}`}
          </button>
          {showDone && (
            <ul class="inbox-list inbox-list--done">
              {done.map((item) => (
                <InboxRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function InboxRow({ item }: { item: InboxItem }) {
  const { db, canEdit } = useApp()
  const date = new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  const url = URL_RE.exec(item.text)?.[0]
  // Черновик места или товара: ссылка — в источники, остальной текст — в заметку.
  const draft = { source: url ?? null, note: url ? item.text.replace(url, '').trim() || null : item.text, inbox: item.id }

  return (
    <li class={`inbox-item${item.doneAt ? ' inbox-item--done' : ''}`}>
      <div class="inbox-item__body">
        <p class="inbox-item__text">
          <InlineText nodes={parseInline(item.text)} />
        </p>
        <span class="inbox-item__date num">{date}</span>
      </div>
      {canEdit && (
        <div class="inbox-item__actions">
          {!item.doneAt && (
            <>
              <button class="btn btn--small" type="button" onClick={() => navigate(buildHash('new', draft))}>
                <IconPlus size={16} />
                Место
              </button>
              <button class="btn btn--small" type="button" onClick={() => navigate(buildHash('new-item', draft))}>
                <IconPlus size={16} />
                Товар
              </button>
            </>
          )}
          <button
            class="icon-btn"
            type="button"
            aria-label={item.doneAt ? 'Вернуть в неразобранные' : 'Отметить разобранным'}
            title={item.doneAt ? 'Вернуть' : 'Разобрано'}
            onClick={() => void setInboxDone(db, item.id, !item.doneAt)}
          >
            <IconCheck size={18} />
          </button>
          <button
            class="icon-btn"
            type="button"
            aria-label="Удалить"
            title="Удалить"
            onClick={() => confirm('Удалить запись из входящих?') && void deleteInbox(db, item.id)}
          >
            <IconTrash size={18} />
          </button>
        </div>
      )}
    </li>
  )
}
