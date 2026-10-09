import type { CategoryGroup, GuideTopic, ItemStatus, SectionId } from '../db/types'

// Разделы, стартовые категории и темы гайдов. Общие для приложения и scripts/japan.ts.

export interface SectionInfo {
  id: SectionId
  /** Название вкладки. */
  title: string
  /** Одно место — «ресторан», «место»… для подписей «Новый …». */
  one: string
  /** Иероглиф раздела — на значке линии. */
  kanji: string
  /** Чтение по-японски — подпись под названием раздела, как на табличке станции. */
  reading: string
  /** Цвет «линии» раздела (цвета линий токийского метро). */
  color: string
  emoji: string
}

export const SECTIONS: readonly SectionInfo[] = [
  { id: 'food', title: 'Еда', one: 'ресторан', kanji: '食', reading: 'たべもの', color: '#f39700', emoji: '🍜' },
  { id: 'fun', title: 'Места', one: 'место', kanji: '遊', reading: 'あそび', color: '#e60012', emoji: '⛩️' },
  { id: 'shop', title: 'Шопинг', one: 'магазин', kanji: '買', reading: 'かいもの', color: '#9b7cb6', emoji: '🛍️' },
  { id: 'hotel', title: 'Отели', one: 'отель', kanji: '泊', reading: 'やど', color: '#009944', emoji: '🏨' },
]

/** «Линия» гайдов — пятая вкладка. */
export const GUIDES_LINE = { title: 'Гайды', kanji: '案', reading: 'あんない', color: '#00a7db' } as const

export function sectionInfo(id: SectionId): SectionInfo {
  return SECTIONS.find((s) => s.id === id) ?? SECTIONS[0]
}

export function isSection(value: unknown): value is SectionId {
  return SECTIONS.some((s) => s.id === value)
}

/** «Что купить» — вкладка «Шопинга»: товары, а не места. Линия та же (фиолетовая 買). */
export const ITEMS_INFO = { title: 'Что купить', one: 'товар', section: 'shop' } as const

export function isCategoryGroup(value: unknown): value is CategoryGroup {
  return value === 'items' || isSection(value)
}

/** Название группы категорий: «Еда», «Что купить»… */
export function groupTitle(group: CategoryGroup): string {
  return group === 'items' ? ITEMS_INFO.title : sectionInfo(group).title
}

export const ITEM_STATUSES: readonly { id: ItemStatus; label: string }[] = [
  { id: 'want', label: 'Купить' },
  { id: 'note', label: 'На заметку' },
  { id: 'bought', label: 'Куплено' },
]

export function isItemStatus(value: unknown): value is ItemStatus {
  return value === 'want' || value === 'note' || value === 'bought'
}

/** Стартовый набор категорий. id детерминированные — повторная загрузка не плодит дублей. */
export const DEFAULT_CATEGORIES: readonly { id: string; section: CategoryGroup; name: string; emoji: string }[] = [
  { id: 'cat-food-ramen', section: 'food', name: 'Рамен', emoji: '🍜' },
  { id: 'cat-food-sushi', section: 'food', name: 'Суши', emoji: '🍣' },
  { id: 'cat-food-yakiniku', section: 'food', name: 'Якинику', emoji: '🥩' },
  { id: 'cat-food-tonkatsu', section: 'food', name: 'Тонкацу', emoji: '🐖' },
  { id: 'cat-food-tempura', section: 'food', name: 'Темпура', emoji: '🍤' },
  { id: 'cat-food-burger', section: 'food', name: 'Бургеры', emoji: '🍔' },
  { id: 'cat-food-izakaya', section: 'food', name: 'Изакая', emoji: '🏮' },
  { id: 'cat-food-street', section: 'food', name: 'Уличная еда', emoji: '🍢' },
  { id: 'cat-food-cafe', section: 'food', name: 'Кафе и десерты', emoji: '🍡' },

  { id: 'cat-fun-temple', section: 'fun', name: 'Храмы и святилища', emoji: '⛩️' },
  { id: 'cat-fun-view', section: 'fun', name: 'Смотровые', emoji: '🗼' },
  { id: 'cat-fun-museum', section: 'fun', name: 'Музеи', emoji: '🖼️' },
  { id: 'cat-fun-park', section: 'fun', name: 'Парки и сады', emoji: '🌸' },
  { id: 'cat-fun-onsen', section: 'fun', name: 'Онсэны', emoji: '♨️' },
  { id: 'cat-fun-fun', section: 'fun', name: 'Развлечения', emoji: '🎡' },

  { id: 'cat-shop-tech', section: 'shop', name: 'Электроника', emoji: '📷' },
  { id: 'cat-shop-anime', section: 'shop', name: 'Аниме и манга', emoji: '📚' },
  { id: 'cat-shop-clothes', section: 'shop', name: 'Одежда', emoji: '👕' },
  { id: 'cat-shop-souvenir', section: 'shop', name: 'Сувениры', emoji: '🎁' },
  { id: 'cat-shop-discount', section: 'shop', name: 'Дисконтеры', emoji: '🛒' },

  { id: 'cat-hotel-hotel', section: 'hotel', name: 'Отель', emoji: '🏨' },
  { id: 'cat-hotel-ryokan', section: 'hotel', name: 'Рёкан', emoji: '🏯' },
  { id: 'cat-hotel-capsule', section: 'hotel', name: 'Капсульный', emoji: '🛏️' },

  { id: 'cat-item-care', section: 'items', name: 'Уход и косметика', emoji: '🧴' },
  { id: 'cat-item-pharmacy', section: 'items', name: 'Аптека', emoji: '💊' },
  { id: 'cat-item-drinks', section: 'items', name: 'Напитки', emoji: '🥤' },
  { id: 'cat-item-food', section: 'items', name: 'Еда', emoji: '🍘' },
  { id: 'cat-item-kitchen', section: 'items', name: 'Кухня', emoji: '🔪' },
  { id: 'cat-item-home', section: 'items', name: 'Дом', emoji: '🏠' },
  { id: 'cat-item-clothes', section: 'items', name: 'Одежда и обувь', emoji: '👟' },
  { id: 'cat-item-tools', section: 'items', name: 'Инструменты', emoji: '🔧' },
  { id: 'cat-item-tech', section: 'items', name: 'Электроника', emoji: '🔌' },
]

export interface TopicInfo {
  id: GuideTopic
  title: string
  emoji: string
}

export const GUIDE_TOPICS: readonly TopicInfo[] = [
  { id: 'transport', title: 'Транспорт', emoji: '🚆' },
  { id: 'money', title: 'Деньги', emoji: '💴' },
  { id: 'connection', title: 'Связь', emoji: '📶' },
  { id: 'documents', title: 'Документы', emoji: '🛂' },
  { id: 'etiquette', title: 'Этикет', emoji: '🙇' },
  { id: 'other', title: 'Прочее', emoji: '📌' },
]

export function topicInfo(id: GuideTopic): TopicInfo {
  return GUIDE_TOPICS.find((t) => t.id === id) ?? GUIDE_TOPICS[GUIDE_TOPICS.length - 1]
}

export function isTopic(value: unknown): value is GuideTopic {
  return GUIDE_TOPICS.some((t) => t.id === value)
}

export const PRICE_LABELS = ['', '¥', '¥¥', '¥¥¥', '¥¥¥¥'] as const
