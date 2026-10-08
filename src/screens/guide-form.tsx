import { useEffect, useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { createGuide, deleteGuide, updateGuide } from '../data/records'
import type { Guide, GuideTopic } from '../db/types'
import { GUIDE_TOPICS, isTopic } from '../domain/catalog'
import { parseMarkdown } from '../domain/markdown'
import { humanizeError } from '../lib/errors'
import { buildHash, goBack, navigate } from '../lib/hooks'
import { ErrorText, Field } from '../ui/components'
import { IconTrash } from '../ui/icons'
import { MarkdownView } from '../ui/markdown'
import { PageHead } from './parts'

const HELP = '# Заголовок · **жирный** · *курсив* · - список · - [ ] чек-лист · | таблица | · [текст](ссылка)'

/** Новый гайд: #/new-guide?topic=money. Правка: #/edit-guide/<id>. */
export function GuideFormScreen(props: { guideId?: string; params: URLSearchParams }) {
  const { db } = useApp()
  const [existing, setExisting] = useState<Guide | null | undefined>(props.guideId ? undefined : null)

  useEffect(() => {
    if (!props.guideId) return
    void db.guides.get(props.guideId).then((g) => setExisting(g && !g.deleted ? g : null))
  }, [props.guideId])

  if (existing === undefined) return null
  if (props.guideId && !existing) {
    return (
      <>
        <PageHead title="Гайд не найден" back="guides" />
        <p class="hint">Возможно, его удалили на другом устройстве.</p>
      </>
    )
  }
  const topic = props.params.get('topic')
  return <GuideForm existing={existing} initialTopic={isTopic(topic) ? topic : 'other'} />
}

function GuideForm({ existing, initialTopic }: { existing: Guide | null; initialTopic: GuideTopic }) {
  const { db } = useApp()
  const [topic, setTopic] = useState<GuideTopic>(existing?.topic ?? initialTopic)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [error, setError] = useState<string | null>(null)

  async function save(event: Event) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Нужно название')
      return
    }
    try {
      const id = existing ? existing.id : await createGuide(db, topic, title, body)
      if (existing) await updateGuide(db, id, { topic, title: title.trim(), body })
      navigate(buildHash(`guide/${id}`), true)
    } catch (err) {
      setError(humanizeError(err))
    }
  }

  async function remove() {
    if (!existing || !confirm(`Удалить гайд «${existing.title}»?`)) return
    await deleteGuide(db, existing.id)
    navigate(buildHash('guides'), true)
  }

  return (
    <>
      <PageHead title={existing ? 'Изменить гайд' : 'Новый гайд'} back={existing ? `guide/${existing.id}` : 'guides'} />
      <form class="guide-form" onSubmit={save}>
        <fieldset class="field field--wide">
          <legend class="field__label">Тема</legend>
          <div class="chips chips--wrap">
            {GUIDE_TOPICS.map((t) => (
              <button type="button" class={`chip${topic === t.id ? ' chip--on' : ''}`} aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>
                <span class="chip__mark" aria-hidden="true">
                  {t.emoji}
                </span>
                {t.title}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Название" wide>
          <input type="text" required value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Например: Suica или JR Pass" />
        </Field>

        <div class="segmented" role="tablist" aria-label="Режим">
          <button type="button" role="tab" aria-selected={tab === 'edit'} class={`segmented__item${tab === 'edit' ? ' segmented__item--on' : ''}`} onClick={() => setTab('edit')}>
            Текст
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            class={`segmented__item${tab === 'preview' ? ' segmented__item--on' : ''}`}
            onClick={() => setTab('preview')}
          >
            Как будет выглядеть
          </button>
        </div>
        {tab === 'edit' ? (
          <Field label="Текст" hint={HELP} wide>
            <textarea class="guide-form__body" rows={16} value={body} onInput={(e) => setBody(e.currentTarget.value)} />
          </Field>
        ) : (
          <div class="guide-form__preview">{body.trim() ? <MarkdownView blocks={parseMarkdown(body)} /> : <p class="hint">Пока пусто</p>}</div>
        )}

        <ErrorText error={error} />
        <div class="form-actions">
          {existing && (
            <button class="btn btn--ghost btn--danger" type="button" onClick={() => void remove()}>
              <IconTrash size={18} />
              Удалить
            </button>
          )}
          <span class="form-actions__spacer" />
          <button class="btn btn--ghost" type="button" onClick={() => goBack(buildHash(existing ? `guide/${existing.id}` : 'guides'))}>
            Отмена
          </button>
          <button class="btn btn--primary" type="submit">
            Сохранить
          </button>
        </div>
      </form>
    </>
  )
}
