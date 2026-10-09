import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { photoUrl } from '../config'
import { createCategory, createItem, deleteItem, setInboxDone, updateItem, type ItemFields } from '../data/records'
import { useRows } from '../data/use-data'
import type { Item, Photo } from '../db/types'
import { ITEM_STATUSES, isItemStatus } from '../domain/catalog'
import { blankItem, findDuplicateItem } from '../domain/items'
import { comparePlaces, sectionCategories } from '../domain/places'
import { humanizeError } from '../lib/errors'
import { buildHash, goBack, navigate } from '../lib/hooks'
import { deletePhotoFiles, uploadPhoto } from '../lib/photos'
import { ErrorText, Field } from '../ui/components'
import { IconCamera, IconPlus, IconTrash } from '../ui/icons'
import { PageHead } from './parts'

/** Новый товар: #/new-item?cat=…&st=…&source=…&note=…&inbox=<id>. Правка: #/edit-item/<id>. */
export function ItemFormScreen(props: { itemId?: string; params: URLSearchParams }) {
  const { db } = useApp()
  const items = useRows('items')
  const [existing, setExisting] = useState<Item | null | undefined>(props.itemId ? undefined : null)

  useEffect(() => {
    if (!props.itemId) return
    void db.items.get(props.itemId).then((i) => setExisting(i && !i.deleted ? i : null))
  }, [props.itemId])

  if (existing === undefined || items === undefined) return null
  if (props.itemId && !existing) {
    return (
      <>
        <PageHead title="Товар не найден" back="items" />
        <p class="hint">Возможно, его удалили на другом устройстве.</p>
      </>
    )
  }
  return <ItemForm existing={existing} items={items} params={props.params} />
}

function initialFields(existing: Item | null, params: URLSearchParams): ItemFields {
  if (existing) {
    const { id: _id, updatedAt: _u, deleted: _d, dirty: _dirty, ...fields } = existing
    return fields
  }
  const source = params.get('source')
  const category = params.get('cat')
  const status = params.get('st')
  return {
    ...blankItem(),
    sourceUrls: source ? [source] : [],
    note: params.get('note') ?? '',
    categoryIds: category ? [category] : [],
    status: isItemStatus(status) ? status : 'want',
  }
}

function ItemForm({ existing, items, params }: { existing: Item | null; items: Item[]; params: URLSearchParams }) {
  const { db, client } = useApp()
  const categories = useRows('categories')
  const places = useRows('places')
  const [fields, setFields] = useState<ItemFields>(() => initialFields(existing, params))
  const [sources, setSources] = useState(() => fields.sourceUrls.join('\n'))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useMemo(() => existing?.id ?? crypto.randomUUID(), [existing])
  const fileInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof ItemFields>(key: K, value: ItemFields[K]) => setFields((f) => ({ ...f, [key]: value }))

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const itemCats = sectionCategories(categories ?? [], 'items')
  // Магазины из «Шопинга» — плюс уже привязанные, даже если их перенесли в другой раздел.
  const shops = (places ?? []).filter((p) => p.section === 'shop' || fields.shopIds.includes(p.id)).sort(comparePlaces)
  const duplicate = fields.name.trim() || fields.nameJa.trim() ? findDuplicateItem(items.filter((i) => i.id !== id), fields) : undefined
  const shownPhoto: string | null = preview ?? (!removePhoto && fields.photo ? photoUrl(fields.photo.thumb) : null)

  function toggle(key: 'categoryIds' | 'shopIds', value: string) {
    setFields((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }))
  }

  async function addCategory(event: Event) {
    event.preventDefault()
    const name = newCategory?.trim()
    if (!name) return
    const categoryId = await createCategory(db, 'items', name, '🛍️')
    setFields((f) => ({ ...f, categoryIds: [...f.categoryIds, categoryId] }))
    setNewCategory(null)
  }

  function pickFile(event: Event) {
    const picked = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!picked) return
    setFile(picked)
    setRemovePhoto(false)
    setPreview(URL.createObjectURL(picked))
  }

  async function save(event: Event) {
    event.preventDefault()
    if (!fields.name.trim()) {
      setError('Нужно название')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let photo: Photo | null = removePhoto ? null : fields.photo
      if (file) {
        if (client) {
          if (!navigator.onLine) throw new Error('Нет сети — фото не загрузить. Сохраните без фото или попробуйте, когда появится связь.')
          photo = await uploadPhoto(client, id, file, 'items')
        } else {
          photo = { path: preview!, thumb: preview!, w: 0, h: 0 } // демо: фото только в этой вкладке
        }
      }
      const old = existing?.photo
      const result: ItemFields = {
        ...fields,
        name: fields.name.trim(),
        nameJa: fields.nameJa.trim(),
        where: fields.where.trim(),
        price: fields.price.trim(),
        note: fields.note.trim(),
        sourceUrls: sources
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean),
        photo,
      }
      if (existing) await updateItem(db, id, result)
      else await createItem(db, result, id)
      if (client && old && old.path !== photo?.path) void deletePhotoFiles(client, old)
      const inboxId = params.get('inbox')
      if (inboxId) await setInboxDone(db, inboxId, true)
      navigate(buildHash(`item/${id}`), true)
    } catch (err) {
      setError(humanizeError(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!existing || !confirm(`Удалить «${existing.name}»?`)) return
    await deleteItem(db, existing.id)
    if (client && existing.photo) void deletePhotoFiles(client, existing.photo)
    navigate(buildHash('items'), true)
  }

  const back = existing ? `item/${existing.id}` : 'items'

  return (
    <>
      <PageHead title={existing ? 'Изменить товар' : 'Новый товар'} back={back} />
      <form class="place-form" onSubmit={save}>
        <div class="segmented segmented--sections segmented--thirds" role="radiogroup" aria-label="Статус">
          {ITEM_STATUSES.map((s) => (
            <button type="button" role="radio" aria-checked={fields.status === s.id} class={`segmented__item${fields.status === s.id ? ' segmented__item--on' : ''}`} onClick={() => set('status', s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        <div class="place-form__photo">
          {shownPhoto ? (
            <img src={shownPhoto} alt="" crossOrigin="anonymous" />
          ) : (
            <div class="place-form__photo-empty">
              <IconCamera size={28} />
              <span>Фото упаковки — показать продавцу</span>
            </div>
          )}
          <div class="place-form__photo-actions">
            <button class="btn btn--small" type="button" onClick={() => fileInput.current?.click()}>
              <IconCamera size={16} />
              {shownPhoto ? 'Заменить' : 'Добавить фото'}
            </button>
            {shownPhoto && (
              <button
                class="btn btn--ghost btn--small"
                type="button"
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  setRemovePhoto(true)
                }}
              >
                Убрать
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>

        <Field label="Название" hint="Как на упаковке или как вам понятнее" wide>
          <input type="text" required value={fields.name} onInput={(e) => set('name', e.currentTarget.value)} />
        </Field>
        {duplicate && (
          <p class="warn">
            Похоже, уже есть: <a href={buildHash(`item/${duplicate.id}`)}>{duplicate.name}</a>
          </p>
        )}
        <Field label="По-японски" hint="Название с упаковки — покажете продавцу" wide>
          <input type="text" lang="ja" value={fields.nameJa} onInput={(e) => set('nameJa', e.currentTarget.value)} />
        </Field>
        <Field label="Что это" hint="Зачем и от чего: «от чёрных точек», «энергетик»" wide>
          <textarea rows={3} value={fields.note} onInput={(e) => set('note', e.currentTarget.value)} />
        </Field>

        <fieldset class="field field--wide">
          <legend class="field__label">Категории</legend>
          <div class="chips chips--wrap">
            {itemCats.map((c) => (
              <button type="button" class={`chip${fields.categoryIds.includes(c.id) ? ' chip--on' : ''}`} aria-pressed={fields.categoryIds.includes(c.id)} onClick={() => toggle('categoryIds', c.id)}>
                <span class="chip__mark" aria-hidden="true">
                  {c.emoji}
                </span>
                {c.name}
              </button>
            ))}
            {newCategory === null ? (
              <button type="button" class="chip chip--add" onClick={() => setNewCategory('')}>
                <IconPlus size={14} />
                Новая
              </button>
            ) : (
              <span class="chip-input">
                <input
                  type="text"
                  autoFocus
                  placeholder="Название категории"
                  value={newCategory}
                  onInput={(e) => setNewCategory(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addCategory(e)
                    if (e.key === 'Escape') setNewCategory(null)
                  }}
                />
                <button type="button" class="btn btn--small" onClick={(e) => void addCategory(e)}>
                  Добавить
                </button>
              </span>
            )}
          </div>
        </fieldset>

        <Field label="Где купить" hint="Например: дрогери (Matsumoto Kiyoshi, Don Quijote)" wide>
          <input type="text" value={fields.where} onInput={(e) => set('where', e.currentTarget.value)} />
        </Field>
        {shops.length > 0 && (
          <fieldset class="field field--wide">
            <legend class="field__label">Магазины из «Шопинга»</legend>
            <div class="chips chips--wrap">
              {shops.map((p) => (
                <button type="button" class={`chip${fields.shopIds.includes(p.id) ? ' chip--on' : ''}`} aria-pressed={fields.shopIds.includes(p.id)} onClick={() => toggle('shopIds', p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div class="form-grid">
          <Field label="Цена">
            <input type="text" inputMode="text" placeholder="¥1,100" value={fields.price} onInput={(e) => set('price', e.currentTarget.value)} />
          </Field>
        </div>
        <Field label="Откуда узнал" hint="Ссылки на рилсы, посты, статьи — каждая с новой строки" wide>
          <textarea rows={2} autoCapitalize="none" value={sources} onInput={(e) => setSources(e.currentTarget.value)} />
        </Field>

        <ErrorText error={error} />

        <div class="form-actions">
          {existing && (
            <button class="btn btn--ghost btn--danger" type="button" onClick={() => void remove()}>
              <IconTrash size={18} />
              Удалить
            </button>
          )}
          <span class="form-actions__spacer" />
          <button class="btn btn--ghost" type="button" onClick={() => goBack(buildHash(back))}>
            Отмена
          </button>
          <button class="btn btn--primary" type="submit" disabled={busy}>
            {busy ? (file ? 'Загружаю фото…' : 'Сохраняю…') : 'Сохранить'}
          </button>
        </div>
      </form>
    </>
  )
}
