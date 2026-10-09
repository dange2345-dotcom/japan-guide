/** 0/1 вместо boolean: IndexedDB не умеет индексировать boolean. */
export type Flag = 0 | 1

/** Служебные поля каждой синхронизируемой записи. */
export interface SyncMeta {
  id: string
  /** Время последнего изменения на устройстве, мс. При конфликте побеждает большее. */
  updatedAt: number
  /** Удаление = пометка, чтобы оно доехало до других устройств. */
  deleted: Flag
  /** 1 — изменение ещё не отправлено в облако. */
  dirty: Flag
}

/** Раздел мест: еда, места и развлечения, шопинг, отели. */
export type SectionId = 'food' | 'fun' | 'shop' | 'hotel'

export type PlaceStatus = 'want' | 'been'

/** Фото места в хранилище jp-photos: большое и миниатюра для карточек. */
export interface Photo {
  path: string
  thumb: string
  w: number
  h: number
}

export interface Place extends SyncMeta {
  section: SectionId
  categoryIds: string[]
  /** Город: «Токио», «Осака»… Свободный текст, фильтр строится по тому, что есть. */
  city: string
  name: string
  /** Название по-японски — показать таксисту или персоналу. */
  nameJa: string
  /** Ближайшая станция. */
  station: string
  stationJa: string
  /** Номер станции с указателей: «G01», «JY20», «M16». По нему рисуется значок в цвете линии. У старых записей поля нет. */
  stationCode?: string
  address: string
  hours: string
  /** 0 — не указано, 1–4 — от ¥ до ¥¥¥¥. */
  price: number
  mapsUrl: string
  /** Откуда узнал: рилсы, посты, статьи. */
  sourceUrls: string[]
  photo: Photo | null
  note: string
  status: PlaceStatus
  favorite: boolean
  createdAt: number
}

/** Чьи категории: раздела мест или товаров («Что купить»). */
export type CategoryGroup = SectionId | 'items'

/** Категория внутри раздела (Рамен, Якинику…) или товаров (Уход, Напитки…). Список редактируется. */
export interface Category extends SyncMeta {
  section: CategoryGroup
  name: string
  emoji: string
  order: number
}

/** «Купить» — в списке покупок, «на заметку» — справка (что это и от чего), «куплено». */
export type ItemStatus = 'want' | 'note' | 'bought'

/** Товар из «Что купить» (вкладка в «Шопинге»): что искать в аптеке, комбини, магазине. */
export interface Item extends SyncMeta {
  name: string
  /** Название на упаковке по-японски — показать продавцу. */
  nameJa: string
  categoryIds: string[]
  /** Что это и зачем. */
  note: string
  /** Где купить — текстом: «дрогери (Matsumoto Kiyoshi, Don Quijote)». */
  where: string
  /** Магазины из раздела «Шопинг», где это продаётся. */
  shopIds: string[]
  /** Цена как в источнике: «¥1,100». */
  price: string
  sourceUrls: string[]
  /** Фото упаковки. */
  photo: Photo | null
  status: ItemStatus
  createdAt: number
}

export type GuideTopic = 'transport' | 'money' | 'connection' | 'documents' | 'etiquette' | 'other'

/** Статья-гайд: проездные, деньги, связь… Текст — простой markdown. */
export interface Guide extends SyncMeta {
  topic: GuideTopic
  title: string
  body: string
  order: number
}

/** «Входящие»: ссылка или заметка, которую разберут потом (сам владелец или Claude). */
export interface InboxItem extends SyncMeta {
  text: string
  createdAt: number
  /** Когда разобрано; null — ещё ждёт. */
  doneAt: number | null
}

export interface MetaRow {
  key: string
  value: unknown
}
