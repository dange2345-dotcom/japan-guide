import { useApp } from '../app-context'
import { useRow, useRows } from '../data/use-data'
import { GUIDE_TOPICS, GUIDES_LINE, isTopic, topicInfo } from '../domain/catalog'
import { parseMarkdown, plainExcerpt } from '../domain/markdown'
import { plural } from '../lib/plural'
import { buildHash, navigate } from '../lib/hooks'
import { EmptyState } from '../ui/components'
import { IconChevronRight, IconEdit, IconPlus } from '../ui/icons'
import { MarkdownView } from '../ui/markdown'
import { PageHead, PlatformSign } from './parts'

/** #/guides?topic=money */
export function GuidesScreen({ params }: { params: URLSearchParams }) {
  const { canEdit } = useApp()
  const guides = useRows('guides')
  const topicParam = params.get('topic')
  const topic = isTopic(topicParam) ? topicParam : null

  if (!guides) return null
  const counts = new Map<string, number>()
  for (const g of guides) counts.set(g.topic, (counts.get(g.topic) ?? 0) + 1)
  const topics = GUIDE_TOPICS.filter((t) => (counts.get(t.id) ?? 0) > 0 && (!topic || t.id === topic))

  return (
    <>
      <PlatformSign
        kanji={GUIDES_LINE.kanji}
        title={GUIDES_LINE.title}
        reading={GUIDES_LINE.reading}
        color={GUIDES_LINE.color}
        meta={`${guides.length} ${plural(guides.length, 'статья', 'статьи', 'статей')}`}
      />

      <nav class="rail" aria-label="Темы" style={{ '--line': GUIDES_LINE.color }}>
        <div class="rail__scroll">
          <button type="button" class={`chip${topic === null ? ' chip--on' : ''}`} aria-pressed={topic === null} onClick={() => navigate(buildHash('guides'), true)}>
            Все
          </button>
          {GUIDE_TOPICS.map((t) => {
            const n = counts.get(t.id) ?? 0
            const on = topic === t.id
            return (
              <button
                type="button"
                class={`chip${on ? ' chip--on' : ''}${n === 0 && !on ? ' chip--empty' : ''}`}
                aria-pressed={on}
                onClick={() => navigate(buildHash('guides', { topic: on ? null : t.id }), true)}
              >
                <span class="chip__mark" aria-hidden="true">
                  {t.emoji}
                </span>
                {t.title}
                {n > 0 && <span class="chip__count num">{n}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      {guides.length === 0 ? (
        <EmptyState title="Гайдов пока нет" text="Проездные, обмен денег, связь, документы — соберите всё полезное в одном месте. Или попросите Claude собрать гайды из ваших заметок.">
          {canEdit && (
            <a class="btn btn--exit" href={buildHash('new-guide', { topic })}>
              <IconPlus size={18} />
              Написать гайд
            </a>
          )}
        </EmptyState>
      ) : (
        <div class="guides">
          {topics.map((t) => (
            <section class="guides__topic" key={t.id}>
              <h2 class="guides__title">
                <span aria-hidden="true">{t.emoji}</span> {t.title}
              </h2>
              <ul class="guides__list">
                {guides
                  .filter((g) => g.topic === t.id)
                  .sort((a, b) => a.order - b.order)
                  .map((g) => (
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
          ))}
        </div>
      )}

      {canEdit && (
        <a class="fab" href={buildHash('new-guide', { topic })} aria-label="Новый гайд" title="Новый гайд">
          <IconPlus size={26} />
        </a>
      )}
    </>
  )
}

export function GuideScreen({ id }: { id: string }) {
  const { canEdit } = useApp()
  const guide = useRow('guides', id)
  if (guide === undefined) return null
  if (guide === null) {
    return (
      <>
        <PageHead title="Гайд не найден" back="guides" />
        <p class="hint">Возможно, его удалили на другом устройстве.</p>
      </>
    )
  }
  const topic = topicInfo(guide.topic)
  return (
    <>
      <PageHead
        title={guide.title}
        sub={`${topic.emoji} ${topic.title}`}
        back="guides"
        actions={
          canEdit && (
            <a class="icon-btn" href={buildHash(`edit-guide/${guide.id}`)} aria-label="Изменить гайд" title="Изменить">
              <IconEdit />
            </a>
          )
        }
      />
      <article class="reader" style={{ '--line': GUIDES_LINE.color }}>
        {guide.body.trim() ? <MarkdownView blocks={parseMarkdown(guide.body)} /> : <p class="hint">Пока пусто.</p>}
      </article>
    </>
  )
}
