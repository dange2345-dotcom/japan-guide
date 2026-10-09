import { useEffect, useMemo, useState } from 'preact/hooks'
import { AppContext, type AppContextValue } from './app-context'
import { canEdit, isRole, setRole, type Role } from './data/access'
import { createDb, type JapanDB } from './db/db'
import type { Category, Guide, InboxItem, Item, Place, SyncMeta } from './db/types'
import { DEFAULT_CATEGORIES } from './domain/catalog'
import { blankItem } from './domain/items'
import { blankPlace } from './domain/places'
import { createSyncEngine } from './sync/engine'
import type { Remote } from './sync/remote'
import { Shell } from './screens/shell'

// Демо-режим для скриншотов и проверки без входа: VITE_DEMO=1 npx vite build --outDir dist-demo.
// Своя база japan-demo, облако-заглушка, синтетические места (фото — Wikimedia Commons, свободные лицензии).
// ?role=viewer — посмотреть приложение глазами зрителя. В обычную сборку не попадает.

const db = createDb('japan-demo')
const nullRemote: Remote = { upsert: async () => {}, pullSince: async () => [] }
const meta = { updatedAt: 1, deleted: 0 as const, dirty: 0 as const }
const WM = 'https://upload.wikimedia.org/wikipedia/commons'

function photo(url: string) {
  return { path: url, thumb: url, w: 960, h: 640 }
}

function place(id: string, fields: Partial<Place> & Pick<Place, 'section' | 'name'>): Place {
  return { ...blankPlace(fields.section), createdAt: 1, ...fields, id, ...meta }
}

const PLACES: Place[] = [
  place('demo-ichiran', {
    section: 'food',
    name: 'Ичиран Сибуя', stationCode: 'G01',
    nameJa: '一蘭 渋谷店',
    categoryIds: ['cat-food-ramen'],
    city: 'Токио',
    station: 'Сибуя',
    stationJa: '渋谷',
    price: 2,
    hours: 'Круглосуточно',
    note: 'Тонкоцу-рамен в кабинках. Демо-запись.',
    photo: photo(`${WM}/2/27/Ichiran_ramen_restaurant_by_amaotou_in_Tokyo.jpg`),
    sourceUrls: ['https://www.instagram.com/reel/demo'],
    favorite: true,
  }),
  place('demo-tonkatsu', {
    section: 'food',
    name: 'Тонкацу в Араки-тё', stationCode: 'M11',
    nameJa: 'とんかつ 荒木町',
    categoryIds: ['cat-food-tonkatsu'],
    city: 'Токио',
    station: 'Ёцуя-сантёмэ',
    stationJa: '四谷三丁目',
    price: 2,
    photo: photo(`${WM}/thumb/9/98/Tonkatsu_restaurant_by_Koichi_Suzuki_in_Araki-cho%2C_Tokyo.jpg/960px-Tonkatsu_restaurant_by_Koichi_Suzuki_in_Araki-cho%2C_Tokyo.jpg`),
  }),
  place('demo-yakiniku', {
    section: 'food',
    name: 'Якинику в Сибуе', stationCode: 'JY20',
    nameJa: '焼肉 渋谷',
    categoryIds: ['cat-food-yakiniku'],
    city: 'Токио',
    station: 'Сибуя',
    stationJa: '渋谷',
    price: 3,
    photo: photo(`${WM}/thumb/9/9b/Yakiniku_restaurant_in_Shibuya.jpg/960px-Yakiniku_restaurant_in_Shibuya.jpg`),
  }),
  place('demo-sushi', {
    section: 'food',
    name: 'Стоячие суши', stationCode: 'JY03',
    nameJa: '立ち食い寿司',
    categoryIds: ['cat-food-sushi'],
    city: 'Токио',
    station: 'Акихабара',
    stationJa: '秋葉原',
    price: 1,
    photo: photo(`${WM}/thumb/7/7c/Inside-standingsushishop-akihabara-nov15-2015.jpg/960px-Inside-standingsushishop-akihabara-nov15-2015.jpg`),
  }),
  place('demo-izakaya', {
    section: 'food',
    name: 'Изакая в Кабуки-тё', stationCode: 'M08',
    nameJa: '歌舞伎町 居酒屋横丁',
    categoryIds: ['cat-food-izakaya'],
    city: 'Токио',
    station: 'Синдзюку',
    stationJa: '新宿',
    price: 2,
    status: 'been',
    photo: photo(`${WM}/thumb/3/3a/Izakaya_alley_in_Kabuki-ch%C5%8D%2C_Shinjuku%2C_Tokyo%2C_Japan%2C_2024_May.jpg/960px-Izakaya_alley_in_Kabuki-ch%C5%8D%2C_Shinjuku%2C_Tokyo%2C_Japan%2C_2024_May.jpg`),
  }),
  place('demo-iekei', {
    section: 'food',
    name: 'Иэкэй-рамен Танака', stationCode: 'M25',
    nameJa: '横浜家系ラーメン 田中',
    categoryIds: ['cat-food-ramen'],
    city: 'Токио',
    station: 'Икэбукуро',
    stationJa: '池袋',
    price: 1,
    photo: photo(
      `${WM}/thumb/f/fd/%E6%A8%AA%E6%B5%9C%E5%AE%B6%E7%B3%BB%E3%83%A9%E3%83%BC%E3%83%A1%E3%83%B3%E7%94%B0%E4%B8%AD_2024%E5%B9%B45%E6%9C%8828%E6%97%A5%E3%81%AE%E6%9D%B1%E4%BA%AC_202405282138_IMG_9554.jpg/960px-%E6%A8%AA%E6%B5%9C%E5%AE%B6%E7%B3%BB%E3%83%A9%E3%83%BC%E3%83%A1%E3%83%B3%E7%94%B0%E4%B8%AD_2024%E5%B9%B45%E6%9C%8828%E6%97%A5%E3%81%AE%E6%9D%B1%E4%BA%AC_202405282138_IMG_9554.jpg`,
    ),
  }),
  place('demo-gyukatsu', {
    section: 'food',
    name: 'Гюкацу Мотомура Намба', stationCode: 'M20',
    nameJa: '牛かつもと村 なんば店',
    categoryIds: ['cat-food-tonkatsu'],
    city: 'Осака',
    station: 'Намба',
    stationJa: '難波',
    price: 2,
  }),
  place('demo-kushikatsu', {
    section: 'food',
    name: 'Кусикацу на Синсэкай', stationCode: 'K18',
    nameJa: '串カツ 新世界',
    categoryIds: ['cat-food-street'],
    city: 'Осака',
    station: 'Эбисутё',
    stationJa: '恵美須町',
    price: 1,
  }),
  place('demo-kinkaku', {
    section: 'fun',
    name: 'Кинкаку-дзи', stationCode: 'K04',
    nameJa: '金閣寺',
    categoryIds: ['cat-fun-temple'],
    city: 'Киото',
    station: 'Китаодзи',
    stationJa: '北大路',
    favorite: true,
    photo: photo(`${WM}/thumb/d/d8/Kinkaku-ji_in_November_2016_-02.jpg/960px-Kinkaku-ji_in_November_2016_-02.jpg`),
  }),
  place('demo-shibuya-sky', {
    section: 'fun',
    name: 'Shibuya Sky', stationCode: 'G01',
    nameJa: '渋谷スカイ',
    categoryIds: ['cat-fun-view'],
    city: 'Токио',
    station: 'Сибуя',
    stationJa: '渋谷',
    price: 2,
    photo: photo(`${WM}/thumb/3/3c/Shibuya_Scramble_Square_-_SHIBUYA_SKY_10.jpg/960px-Shibuya_Scramble_Square_-_SHIBUYA_SKY_10.jpg`),
  }),
  place('demo-arcade', {
    section: 'fun',
    name: 'Аркады Акихабары', stationCode: 'JY03',
    nameJa: '秋葉原 ゲームセンター',
    categoryIds: ['cat-fun-fun'],
    city: 'Токио',
    station: 'Акихабара',
    stationJa: '秋葉原',
    photo: photo(
      `${WM}/thumb/0/07/Claw_cranes_with_kawaii_stuffed_mascots_and_a_woman_playing%2C_Akihabara%2C_Chiyoda%2C_Tokyo%2C_Japan.jpg/960px-Claw_cranes_with_kawaii_stuffed_mascots_and_a_woman_playing%2C_Akihabara%2C_Chiyoda%2C_Tokyo%2C_Japan.jpg`,
    ),
  }),
  place('demo-donki', {
    section: 'shop',
    name: 'Дон Кихот Акихабара', stationCode: 'JY03',
    nameJa: 'ドン・キホーテ 秋葉原店',
    categoryIds: ['cat-shop-discount', 'cat-shop-souvenir'],
    city: 'Токио',
    station: 'Акихабара',
    stationJa: '秋葉原',
    hours: 'До поздней ночи',
    photo: photo(`${WM}/5/50/Don_Quixote_in_Akihabara.jpg`),
  }),
  place('demo-electric', {
    section: 'shop',
    name: 'Электрический город', stationCode: 'JY03',
    nameJa: '秋葉原電気街',
    categoryIds: ['cat-shop-tech', 'cat-shop-anime'],
    city: 'Токио',
    station: 'Акихабара',
    stationJa: '秋葉原',
    photo: photo(`${WM}/thumb/d/df/Akihabara_Electric_Town_9999_326.jpg/960px-Akihabara_Electric_Town_9999_326.jpg`),
  }),
  place('demo-ryokan', {
    section: 'hotel',
    name: 'Рёкан у Гиона',
    nameJa: '祇園 旅館',
    categoryIds: ['cat-hotel-ryokan'],
    city: 'Киото',
    station: 'Гион-Сидзё',
    stationJa: '祇園四条',
    price: 3,
  }),
]

const GUIDES: Guide[] = [
  {
    id: 'demo-suica',
    topic: 'transport',
    title: 'Suica в iPhone',
    order: 1,
    body: [
      'Демо-гайд. Проездной Suica можно добавить в Apple Wallet и прикладывать телефон к турникету.',
      '',
      '## Что сделать до поездки',
      '- [x] Проверить, что iPhone поддерживает Suica',
      '- [ ] Добавить карту в Wallet',
      '- [ ] Включить «Экспресс-карта», чтобы не разблокировать телефон',
      '',
      '| Где | Работает |',
      '|---|---|',
      '| Метро и JR | да |',
      '| Конбини | да |',
      '',
      '> Подробнее: https://www.jreast.co.jp/multi/en/pass/suica.html',
    ].join('\n'),
    ...meta,
  },
  {
    id: 'demo-money',
    topic: 'money',
    title: 'Наличные и карты',
    order: 2,
    body: 'Демо-гайд. Где снимать йены, сколько держать наличными и где платят картой.\n\n## Банкоматы\n- В конбини\n- На почте',
    ...meta,
  },
]

function item(id: string, fields: Partial<Item> & Pick<Item, 'name'>): Item {
  return { ...blankItem(), createdAt: 1, ...fields, id, ...meta }
}

const ITEMS: Item[] = [
  item('demo-item-knife', { name: 'Кухонный нож сантоку', nameJa: '三徳包丁', categoryIds: ['cat-item-kitchen'], where: 'Каппабаси, Асакуса', note: 'Универсальный нож — мясо, рыба, овощи' }),
  item('demo-item-matcha', { name: 'Матча для заваривания', nameJa: '抹茶', categoryIds: ['cat-item-food'], where: 'Киото, лавки у храмов', price: '¥1,500', note: 'Порошок высшего сорта, 30 г' }),
  item('demo-item-sunscreen', { name: 'Солнцезащитный гель', nameJa: '日焼け止めジェル', categoryIds: ['cat-item-care'], where: 'дрогери', note: 'Лёгкий, без белых следов', status: 'bought' }),
  item('demo-item-energy', { name: 'Энергетик из аптеки', nameJa: 'エナジードリンク', categoryIds: ['cat-item-drinks'], where: 'комбини, дрогери', note: 'Маленькая бутылочка, от усталости', status: 'note' }),
]

const INBOX: InboxItem[] = [
  { id: 'demo-in-1', text: 'https://www.instagram.com/reel/demo-ramen — рамен с трюфелем, где-то в Сибуе', createdAt: 1, doneAt: null, ...meta },
  { id: 'demo-in-2', text: 'Кафе с совами в Харадзюку — посмотреть', createdAt: 2, doneAt: null, ...meta },
]

async function seed(target: JapanDB) {
  if ((await target.categories.count()) > 0) return
  const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i + 1, ...meta }))
  await target.categories.bulkPut(categories as (Category & SyncMeta)[])
  await target.places.bulkPut(PLACES)
  await target.guides.bulkPut(GUIDES)
  await target.items.bulkPut(ITEMS)
  await target.inbox.bulkPut(INBOX)
}

export function DemoApp() {
  const [ready, setReady] = useState(false)
  const param = new URLSearchParams(location.search).get('role')
  const role: Role = isRole(param) ? param : 'owner'
  setRole(role)
  const engine = useMemo(() => createSyncEngine(db, nullRemote), [])

  useEffect(() => {
    void seed(db).then(() => setReady(true))
  }, [])

  const context = useMemo<AppContextValue>(
    () => ({
      db,
      sync: engine,
      client: null,
      userId: 'demo',
      email: 'demo@example.com',
      role,
      canEdit: canEdit(role),
      signOut: async () => {
        await db.delete()
        location.reload()
      },
    }),
    [engine, role],
  )

  if (!ready) return null
  return (
    <AppContext.Provider value={context}>
      <Shell />
    </AppContext.Provider>
  )
}
