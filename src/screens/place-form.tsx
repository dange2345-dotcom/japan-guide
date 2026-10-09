import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { photoUrl } from '../config'
import { createCategory, createPlace, deletePlace, setInboxDone, updatePlace, type PlaceFields } from '../data/records'
import { useRows } from '../data/use-data'
import type { Photo, Place, SectionId } from '../db/types'
import { PRICE_LABELS, SECTIONS, isSection, sectionInfo } from '../domain/catalog'
import { normalizeStationCode } from '../domain/lines'
import { blankPlace, citiesOf, findDuplicate, sectionCategories } from '../domain/places'
import { humanizeError } from '../lib/errors'
import { buildHash, goBack, navigate } from '../lib/hooks'
import { deletePhotoFiles, uploadPhoto } from '../lib/photos'
import { ErrorText, Field } from '../ui/components'
import { IconCamera, IconPlus, IconTrash } from '../ui/icons'
import { PageHead, StationBadge } from './parts'

/** Новое место: #/new?section=food&source=…&note=…&inbox=<id>. Правка: #/edit/<id>. */
export function PlaceFormScreen(props: { placeId?: string; params: URLSearchParams }) {
  const { db } = useApp()
  const places = useRows('places')
  const [existing, setExisting] = useState<Place | null | undefined>(props.placeId ? undefined : null)

  useEffect(() => {
    if (!props.placeId) return
    void db.places.get(props.placeId).then((p) => setExisting(p && !p.deleted ? p : null))
  }, [props.placeId])

  if (existing === undefined || places === undefined) return null
  if (props.placeId && !existing) {
    return (
      <>
        <PageHead title="Место не найдено" back="food" />
        <p class="hint">Возможно, его удалили на другом устройстве.</p>
      </>
    )
  }
  return <PlaceForm existing={existing} places={places} params={props.params} />
}

function initialFields(existing: Place | null, params: URLSearchParams): PlaceFields {
  if (existing) {
    const { id: _id, updatedAt: _u, deleted: _d, dirty: _dirty, ...fields } = existing
    return fields
  }
  const section = params.get('section')
  const fields = blankPlace(isSection(section) ? section : 'food')
  const source = params.get('source')
  const category = params.get('cat')
  return {
    ...fields,
    sourceUrls: source ? [source] : [],
    note: params.get('note') ?? '',
    categoryIds: category ? [category] : [],
    city: params.get('city') ?? '',
  }
}

function PlaceForm({ existing, places, params }: { existing: Place | null; places: Place[]; params: URLSearchParams }) {
  const { db, client } = useApp()
  const categories = useRows('categories')
  const [fields, setFields] = useState<PlaceFields>(() => initialFields(existing, params))
  const [sources, setSources] = useState(() => fields.sourceUrls.join('\n'))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useMemo(() => existing?.id ?? crypto.randomUUID(), [existing])
  const fileInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof PlaceFields>(key: K, value: PlaceFields[K]) => setFields((f) => ({ ...f, [key]: value }))

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const sectionCats = sectionCategories(categories ?? [], fields.section)
  const cities = citiesOf(places)
  const branches = fields.branches ?? []
  const duplicate = fields.name.trim()
    ? findDuplicate(
        places.filter((p) => p.id !== id),
        { section: fields.section, name: fields.name, city: fields.city, mapsUrl: fields.mapsUrl },
      )
    : undefined

  const shownPhoto: string | null = preview ?? (!removePhoto && fields.photo ? photoUrl(fields.photo.thumb) : null)

  function changeSection(section: SectionId) {
    // Категории другого раздела не подходят — снимаем.
    setFields((f) => ({ ...f, section, categoryIds: f.section === section ? f.categoryIds : [] }))
  }

  function toggleCategory(categoryId: string) {
    set('categoryIds', fields.categoryIds.includes(categoryId) ? fields.categoryIds.filter((c) => c !== categoryId) : [...fields.categoryIds, categoryId])
  }

  async function addCategory(event: Event) {
    event.preventDefault()
    const name = newCategory?.trim()
    if (!name) return
    const categoryId = await createCategory(db, fields.section, name, '📍')
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
          photo = await uploadPhoto(client, id, file)
        } else {
          photo = { path: preview!, thumb: preview!, w: 0, h: 0 } // демо: фото только в этой вкладке
        }
      }
      const old = existing?.photo
      const result: PlaceFields = {
        ...fields,
        name: fields.name.trim(),
        nameJa: fields.nameJa.trim(),
        city: fields.city.trim(),
        station: fields.station.trim(),
        stationJa: fields.stationJa.trim(),
        stationCode: fields.stationCode?.trim() ? normalizeStationCode(fields.stationCode) : '',
        address: fields.address.trim(),
        hours: fields.hours.trim(),
        mapsUrl: fields.mapsUrl.trim(),
        note: fields.note.trim(),
        sourceUrls: sources
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean),
        photo,
      }
      if (existing) await updatePlace(db, id, result)
      else await createPlace(db, result, id)
      if (client && old && old.path !== photo?.path) void deletePhotoFiles(client, old)
      const inboxId = params.get('inbox')
      if (inboxId) await setInboxDone(db, inboxId, true)
      navigate(buildHash(`place/${id}`), true)
    } catch (err) {
      setError(humanizeError(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!existing || !confirm(`Удалить «${existing.name}»?`)) return
    await deletePlace(db, existing.id)
    if (client && existing.photo) void deletePhotoFiles(client, existing.photo)
    navigate(buildHash(existing.section), true)
  }

  const info = sectionInfo(fields.section)

  return (
    <>
      <PageHead title={existing ? 'Изменить место' : `Новый ${info.one}`} back={existing ? `place/${existing.id}` : fields.section} />
      <form class="place-form" onSubmit={save}>
        <div class="segmented segmented--sections" role="radiogroup" aria-label="Раздел">
          {SECTIONS.map((s) => (
            <button
              type="button"
              role="radio"
              aria-checked={fields.section === s.id}
              class={`segmented__item${fields.section === s.id ? ' segmented__item--on' : ''}`}
              data-section={s.id}
              onClick={() => changeSection(s.id)}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div class="place-form__photo">
          {shownPhoto ? (
            <img src={shownPhoto} alt="" crossOrigin="anonymous" />
          ) : (
            <div class="place-form__photo-empty">
              <IconCamera size={28} />
              <span>Фото с улицы или из зала</span>
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

        <Field label="Название" wide>
          <input type="text" required value={fields.name} onInput={(e) => set('name', e.currentTarget.value)} />
        </Field>
        {duplicate && (
          <p class="warn">
            Похоже, уже есть: <a href={buildHash(`place/${duplicate.id}`)}>{duplicate.name}</a>
            {duplicate.city ? `, ${duplicate.city}` : ''}
          </p>
        )}
        <Field label="По-японски" hint="Покажете таксисту или персоналу" wide>
          <input type="text" lang="ja" value={fields.nameJa} onInput={(e) => set('nameJa', e.currentTarget.value)} />
        </Field>

        <fieldset class="field field--wide">
          <legend class="field__label">Категории</legend>
          <div class="chips chips--wrap">
            {sectionCats.map((c) => (
              <button type="button" class={`chip${fields.categoryIds.includes(c.id) ? ' chip--on' : ''}`} aria-pressed={fields.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
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

        <div class="form-grid">
          <Field label="Город">
            <input type="text" list="jp-cities" value={fields.city} onInput={(e) => set('city', e.currentTarget.value)} />
            <datalist id="jp-cities">
              {cities.map((c) => (
                <option value={c} />
              ))}
            </datalist>
          </Field>
          {!branches.length && (
            <>
              <Field label="Ближайшая станция">
                <input type="text" value={fields.station} onInput={(e) => set('station', e.currentTarget.value)} />
              </Field>
              <Field label="Станция по-японски">
                <input type="text" lang="ja" value={fields.stationJa} onInput={(e) => set('stationJa', e.currentTarget.value)} />
              </Field>
              <Field label="Номер станции" hint="С указателей: G01, JY20 — нарисуется значок линии">
                <input
                  type="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellcheck={false}
                  value={fields.stationCode ?? ''}
                  onInput={(e) => set('stationCode', e.currentTarget.value)}
                  onBlur={(e) => set('stationCode', e.currentTarget.value.trim() ? normalizeStationCode(e.currentTarget.value) : '')}
                />
              </Field>
              <Field label="Часы работы">
                <input type="text" placeholder="11:00–22:00, вт выходной" value={fields.hours} onInput={(e) => set('hours', e.currentTarget.value)} />
              </Field>
            </>
          )}
        </div>

        {branches.length > 0 && (
          <fieldset class="field field--wide">
            <legend class="field__label">Точки сети — {branches.length}</legend>
            <ul class="branch-edit">
              {branches.map((b, index) => (
                <li class="branch-edit__item">
                  <StationBadge code={b.stationCode} city={b.city} />
                  <span class="branch-edit__text">
                    <span class="branch-edit__station">{[b.station || b.stationJa, b.name].filter(Boolean).join(' · ') || b.nameJa}</span>
                    {b.address && (
                      <span class="branch-edit__address" lang="ja">
                        {b.address}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    class="icon-btn"
                    aria-label={`Убрать точку ${b.station}`}
                    onClick={() => set('branches', branches.filter((_, i) => i !== index))}
                  >
                    <IconTrash size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <fieldset class="field field--wide">
          <legend class="field__label">Цена</legend>
          <div class="segmented" role="radiogroup" aria-label="Цена">
            {PRICE_LABELS.map((label, price) => (
              <button
                type="button"
                role="radio"
                aria-checked={fields.price === price}
                class={`segmented__item${fields.price === price ? ' segmented__item--on' : ''}`}
                onClick={() => set('price', price)}
              >
                {label || '—'}
              </button>
            ))}
          </div>
        </fieldset>

        {!branches.length && (
          <>
            <Field label="Ссылка Google Maps" hint="Поделиться → Скопировать ссылку" wide>
              <input type="url" inputMode="url" autoCapitalize="none" value={fields.mapsUrl} onInput={(e) => set('mapsUrl', e.currentTarget.value)} />
            </Field>
            <Field label="Адрес" wide>
              <input type="text" value={fields.address} onInput={(e) => set('address', e.currentTarget.value)} />
            </Field>
          </>
        )}
        <Field label="Откуда узнал" hint="Ссылки на рилсы, посты, статьи — каждая с новой строки" wide>
          <textarea rows={2} autoCapitalize="none" value={sources} onInput={(e) => setSources(e.currentTarget.value)} />
        </Field>
        <Field label="Заметка" wide>
          <textarea rows={3} value={fields.note} onInput={(e) => set('note', e.currentTarget.value)} />
        </Field>

        <div class="form-toggles">
          <div class="segmented" role="radiogroup" aria-label="Статус">
            {(
              [
                ['want', 'Хочу'],
                ['been', 'Был'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={fields.status === value}
                class={`segmented__item${fields.status === value ? ' segmented__item--on' : ''}`}
                onClick={() => set('status', value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label class="check">
            <input type="checkbox" checked={fields.favorite} onChange={(e) => set('favorite', e.currentTarget.checked)} />
            <span>Избранное</span>
          </label>
        </div>

        <ErrorText error={error} />

        <div class="form-actions">
          {existing && (
            <button class="btn btn--ghost btn--danger" type="button" onClick={() => void remove()}>
              <IconTrash size={18} />
              Удалить
            </button>
          )}
          <span class="form-actions__spacer" />
          <button class="btn btn--ghost" type="button" onClick={() => goBack(buildHash(existing ? `place/${existing.id}` : fields.section))}>
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
