import { useEffect, useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { photoUrl } from '../config'
import { updateItem } from '../data/records'
import { useRow, useRows } from '../data/use-data'
import type { Category, Item, ItemStatus, Place } from '../db/types'
import { ITEM_STATUSES, ITEMS_INFO, isItemStatus, sectionInfo } from '../domain/catalog'
import { filterItems, itemCategoryCounts, type ItemFilter, type ItemStatusFilter } from '../domain/items'
import { sectionCategories } from '../domain/places'
import { buildHash, goBack, navigate } from '../lib/hooks'
import { plural } from '../lib/plural'
import { EmptyState } from '../ui/components'
import { IconBack, IconCheck, IconEdit, IconKana, IconLink, IconPlus } from '../ui/icons'
import { CategoriesSheet } from './categories-sheet'
import { HeaderTools, PlacePhoto, PlatformSign, ShopTabs } from './parts'
import { sourceLabel } from './place'
import { useListScroll } from './section'

// «Что купить» — вкладка «Шопинга»: список покупок и справка по товарам (что это, где искать).
// #/items?cat=…&st=want|note|bought, товар — #/item/<id>.

const STATUS_FILTERS: { id: ItemStatusFilter; label: string }[] = [{ id: 'all', label: 'Все' }, ...ITEM_STATUSES]

export function readItemFilter(params: URLSearchParams): ItemFilter {
  const st = params.get('st')
  return { category: params.get('cat'), status: isItemStatus(st) ? st : 'all' }
}

export function itemFilterParams(filter: ItemFilter): Record<string, string | null> {
  return { cat: filter.category, st: filter.status === 'all' ? null : filter.status }
}

/** Где купить: свой текст, а если его нет — названия привязанных магазинов. */
function whereText(item: Item, places: Map<string, Place>): string {
  if (item.where.trim()) return item.where.trim()
  return item.shopIds
    .map((id) => places.get(id)?.name)
    .filter(Boolean)
    .join(', ')
}

/** Отметка «куплено» туда и обратно (снятая — снова в списке покупок). */
function toggleBought(item: Item): ItemStatus {
  return item.status === 'bought' ? 'want' : 'bought'
}

export function ItemsScreen({ params }: { params: URLSearchParams }) {
  const { db, canEdit } = useApp()
  const items = useRows('items')
  const places = useRows('places')
  const categories = useRows('categories')
  const [editing, setEditing] = useState(false)
  const filter = readItemFilter(params)
  const shop = sectionInfo('shop')

  const setFilter = (next: Partial<ItemFilter>) => navigate(buildHash('items', itemFilterParams({ ...filter, ...next })), true)

  useListScroll(Boolean(items && places && categories))

  if (!items || !places || !categories) return null

  const cats = sectionCategories(categories, 'items')
  const counts = itemCategoryCounts(items, filter)
  const list = filterItems(items, filter)
  const byId = new Map(categories.map((c) => [c.id, c]))
  const placeById = new Map(places.filter((p) => !p.deleted).map((p) => [p.id, p]))
  const shopCount = places.filter((p) => p.section === 'shop').length
  const detailParams = itemFilterParams(filter)
  const filtered = Boolean(filter.category) || filter.status !== 'all'
  // Без фильтра по статусу — группами: «Купить», «На заметку», «Куплено».
  const groups =
    filter.status === 'all'
      ? ITEM_STATUSES.map((s) => ({ id: s.id, label: s.label as string | null, items: list.filter((i) => i.status === s.id) })).filter((g) => g.items.length > 0)
      : [{ id: filter.status, label: null, items: list }]

  return (
    <>
      <PlatformSign kanji={shop.kanji} title={shop.title} reading={shop.reading} color={shop.color} meta={`${items.length} ${plural(items.length, 'товар', 'товара', 'товаров')}`} />

      <ShopTabs current="items" shops={shopCount} items={items.length} />

      <nav class="rail" aria-label="Категории" style={{ '--line': shop.color }}>
        <div class="rail__scroll">
          <button type="button" class={`chip${filter.category === null ? ' chip--on' : ''}`} aria-pressed={filter.category === null} onClick={() => setFilter({ category: null })}>
            Все
          </button>
          {cats.map((c) => {
            const on = filter.category === c.id
            const n = counts.get(c.id) ?? 0
            return (
              <button type="button" class={`chip${on ? ' chip--on' : ''}${n === 0 && !on ? ' chip--empty' : ''}`} aria-pressed={on} onClick={() => setFilter({ category: on ? null : c.id })}>
                <span class="chip__mark" aria-hidden="true">
                  {c.emoji}
                </span>
                {c.name}
                {n > 0 && <span class="chip__count num">{n}</span>}
              </button>
            )
          })}
          {canEdit && (
            <button type="button" class="chip chip--tool" onClick={() => setEditing(true)} aria-label="Изменить категории">
              <IconEdit size={15} />
            </button>
          )}
        </div>
      </nav>

      <div class="filters">
        <div class="segmented segmented--compact" role="radiogroup" aria-label="Статус">
          {STATUS_FILTERS.map((s) => (
            <button
              type="button"
              role="radio"
              aria-checked={filter.status === s.id}
              class={`segmented__item${filter.status === s.id ? ' segmented__item--on' : ''}`}
              onClick={() => setFilter({ status: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Список пуст" text="Добавьте, что хотите купить, — с фото упаковки, чтобы показать продавцу. Или попросите Claude перенести из Notion.">
          {canEdit && (
            <a class="btn btn--exit" href={buildHash('new-item')}>
              <IconPlus size={18} />
              Добавить
            </a>
          )}
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState title="Ничего не нашлось" text={filtered ? 'С такими фильтрами товаров нет.' : undefined}>
          <button class="btn" type="button" onClick={() => navigate(buildHash('items'), true)}>
            Сбросить фильтры
          </button>
        </EmptyState>
      ) : (
        <div class="item-groups" key={`${filter.category}|${filter.status}`} style={{ '--line': shop.color }}>
          {groups.map((group) => (
            <section class="item-group" aria-label={group.label ?? undefined}>
              {group.label && (
                <h2 class="item-group__title">
                  {group.label}
                  <span class="item-group__count num">{group.items.length}</span>
                </h2>
              )}
              <ul class="item-list">
                {group.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    categories={byId}
                    where={whereText(item, placeById)}
                    href={buildHash(`item/${item.id}`, detailParams)}
                    onToggle={canEdit && item.status !== 'note' ? () => void updateItem(db, item.id, { status: toggleBought(item) }) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canEdit && (
        <a class="fab" href={buildHash('new-item', { cat: filter.category, st: filter.status === 'all' ? null : filter.status })} aria-label="Добавить товар" title="Новый товар">
          <IconPlus size={26} />
        </a>
      )}

      {editing && <CategoriesSheet section="items" onClose={() => setEditing(false)} />}
    </>
  )
}

function ItemRow(props: { item: Item; categories: Map<string, Category>; where: string; href: string; onToggle?: () => void }) {
  const { item } = props
  const bought = item.status === 'bought'
  const cats = item.categoryIds.map((id) => props.categories.get(id)?.name).filter(Boolean)
  const meta = [props.where, item.price].filter(Boolean).join(' · ')
  return (
    <li class={`item-row${bought ? ' item-row--bought' : ''}`}>
      <a class="item-row__main" href={props.href}>
        <span class="result__thumb">
          <PlacePhoto photo={item.photo} section="shop" />
        </span>
        <span class="item-row__text">
          <span class="item-row__name">{item.name}</span>
          {item.note ? <span class="item-row__note">{item.note}</span> : cats.length > 0 && <span class="item-row__note">{cats.join(', ')}</span>}
          {meta && <span class="item-row__meta">{meta}</span>}
        </span>
      </a>
      {props.onToggle && (
        <button
          type="button"
          class={`item-check${bought ? ' item-check--on' : ''}`}
          aria-pressed={bought}
          aria-label={`Куплено: ${item.name}`}
          title={bought ? 'Куплено — нажмите, чтобы вернуть в список' : 'Отметить купленным'}
          onClick={props.onToggle}
        >
          <IconCheck size={20} />
        </button>
      )}
    </li>
  )
}

/* ---------- Товар ---------- */

/** #/item/<id>?cat=…&st=… — фильтр нужен, чтобы «Назад» вернул к тому же списку. */
export function ItemScreen({ id, params }: { id: string; params: URLSearchParams }) {
  const item = useRow('items', id)
  const places = useRows('places')
  const categories = useRows('categories')

  if (item === undefined || !places || !categories) return null
  if (item === null) {
    return (
      <section class="empty">
        <h2>Товара нет</h2>
        <p>Возможно, его удалили на другом устройстве.</p>
        <a class="btn" href={buildHash('items')}>
          К списку покупок
        </a>
      </section>
    )
  }
  return <ItemView key={item.id} item={item} places={places} categories={categories} back={buildHash('items', itemFilterParams(readItemFilter(params)))} />
}

function ItemView(props: { item: Item; places: Place[]; categories: Category[]; back: string }) {
  const { item } = props
  const { db, canEdit } = useApp()
  const [showing, setShowing] = useState(false)
  const shop = sectionInfo('shop')
  const cats = item.categoryIds.map((id) => props.categories.find((c) => c.id === id)?.name).filter(Boolean)
  const shops = item.shopIds.map((id) => props.places.find((p) => p.id === id)).filter((p): p is Place => Boolean(p))
  const bought = item.status === 'bought'

  return (
    <article class="place" style={{ '--line': shop.color }}>
      <div class="place__top">
        <button class="icon-btn icon-btn--float" type="button" aria-label="Назад" onClick={() => goBack(props.back)}>
          <IconBack />
        </button>
        <HeaderTools />
      </div>

      <div class="place__photo place__photo--item">
        <PlacePhoto photo={item.photo} section="shop" large alt={item.name} />
      </div>

      <section class="board">
        <h1 class="board__name">{item.name}</h1>
        {item.nameJa && (
          <p class="board__ja" lang="ja">
            {item.nameJa}
          </p>
        )}
        <div class="board__status">
          <span class="board__line">
            <span class="board__dot" aria-hidden="true" />
            {ITEMS_INFO.title}
            {cats.length > 0 && ` · ${cats.join(', ')}`}
          </span>
          {bought && (
            <span class="tag tag--been">
              <IconCheck size={14} /> Куплено
            </span>
          )}
          {item.status === 'note' && <span class="tag tag--note">На заметку</span>}
        </div>
      </section>

      {(item.nameJa || item.photo) && (
        <div class="place__actions">
          <button class="btn btn--exit btn--block" type="button" onClick={() => setShowing(true)}>
            <IconKana size={20} />
            Показать продавцу
          </button>
        </div>
      )}

      <dl class="rows">
        {item.note && (
          <div class="rows__item rows__item--note">
            <dt>Что это</dt>
            <dd>{item.note}</dd>
          </div>
        )}
        {(item.where || shops.length > 0) && (
          <div class="rows__item">
            <dt>Где купить</dt>
            <dd class="rows__where">
              {item.where && <span>{item.where}</span>}
              {shops.length > 0 && (
                <span class="rows__links">
                  {shops.map((p) => (
                    <a href={buildHash(`place/${p.id}`)}>
                      <span class="rows__shop-mark" aria-hidden="true" lang="ja">
                        {shop.kanji}
                      </span>
                      {p.name}
                    </a>
                  ))}
                </span>
              )}
            </dd>
          </div>
        )}
        {item.price && (
          <div class="rows__item">
            <dt>Цена</dt>
            <dd class="num">{item.price}</dd>
          </div>
        )}
        {item.sourceUrls.length > 0 && (
          <div class="rows__item">
            <dt>Откуда</dt>
            <dd class="rows__links">
              {item.sourceUrls.map((url) => (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <IconLink size={16} />
                  {sourceLabel(url)}
                </a>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {canEdit && (
        <div class="place__edit">
          {item.status === 'note' ? (
            <button class="btn" type="button" onClick={() => void updateItem(db, item.id, { status: 'want' })}>
              <IconPlus size={18} />В список покупок
            </button>
          ) : (
            <button class={`btn${bought ? ' btn--on' : ''}`} type="button" aria-pressed={bought} onClick={() => void updateItem(db, item.id, { status: toggleBought(item) })}>
              <IconCheck size={18} />
              {bought ? 'Куплено' : 'Отметить «куплено»'}
            </button>
          )}
          <a class="btn" href={buildHash(`edit-item/${item.id}`)}>
            <IconEdit size={18} />
            Изменить
          </a>
        </div>
      )}

      {showing && <SellerBoard item={item} onClose={() => setShowing(false)} />}
    </article>
  )
}

/** На весь экран: фото упаковки, название по-японски и вопрос «Есть ли у вас этот товар?». Нажатие закрывает. */
function SellerBoard({ item, onClose }: { item: Item; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div class="ja-board" role="dialog" aria-modal="true" aria-label="Показать продавцу" onClick={onClose} style={{ '--line': sectionInfo('shop').color }}>
      <div class="ja-board__sign">
        {item.photo && <img class="ja-board__photo" src={photoUrl(item.photo.path)} alt="" crossOrigin="anonymous" />}
        <p class="ja-board__name ja-board__name--item" lang="ja">
          {item.nameJa || item.name}
        </p>
        <p class="ja-board__station" lang="ja">
          この商品はありますか？
        </p>
        <p class="ja-board__ru">
          {item.nameJa ? `${item.name} · ` : ''}«Есть ли у вас этот товар?»
        </p>
      </div>
      <p class="ja-board__hint">Нажмите, чтобы закрыть</p>
    </div>
  )
}
