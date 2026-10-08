// Номера станций с японских указателей («G01», «JY20») → буквы линии, номер и её цвет.
// Цвета — официальные цвета линий: метро Токио и Toei, линии JR East в Токио, метро Осаки.
// Незнакомый код рисуется нейтральным значком.

export interface StationBadgeInfo {
  /** Буквы линии: «G», «JY». */
  line: string
  /** Номер станции: «01». */
  number: string
  /** Цвет линии или null, если линия незнакома. */
  color: string | null
  /** JR рисует номера в скруглённом квадрате, метро — в круге. */
  shape: 'circle' | 'square'
}

const TOKYO: Record<string, string> = {
  // Tokyo Metro
  G: '#f39700', // Гиндза
  M: '#e60012', // Маруноути
  H: '#9caeb7', // Хибия
  T: '#00a7db', // Тодзай
  C: '#009944', // Тиёда
  Y: '#d7c447', // Юракутё
  Z: '#9b7cb6', // Хандзомон
  N: '#00ada9', // Намбоку
  F: '#bb641d', // Фукутосин
  // Toei
  A: '#e85298', // Асакуса
  I: '#0079c2', // Мита
  S: '#6cbb5a', // Синдзюку
  E: '#b6007a', // Оэдо
}

const JR_EAST: Record<string, string> = {
  JY: '#80c241', // Яманотэ
  JC: '#f15a22', // Тюо (скорая)
  JB: '#ffd400', // Тюо-Собу
  JK: '#00b2e5', // Кэйхин-Тохоку
  JA: '#00ac9a', // Сайкё
  JS: '#e21f26', // Сёнан-Синдзюку
  JO: '#0067c0', // Ёкосука
}

const OSAKA: Record<string, string> = {
  M: '#e5171f', // Мидосудзи
  T: '#522886', // Танимати
  Y: '#0078ba', // Ёцубаси
  C: '#019a66', // Тюо
  S: '#e44d93', // Сэннитимаэ
  K: '#814721', // Сакаисудзи
  N: '#a9cc51', // Нагахори-Цуруми-рёкути
  I: '#ee7b1a', // Имадзатосудзи
}

/** «g-1», « jy 20 » → «G01», «JY20». Непонятное — как есть, заглавными. */
export function normalizeStationCode(code: string): string {
  const match = /^\s*([a-z]{1,2})\s*-?\s*(\d{1,2})\s*$/i.exec(code)
  if (!match) return code.trim().toUpperCase()
  return `${match[1].toUpperCase()}${match[2].padStart(2, '0')}`
}

export function stationBadge(code: string | undefined, city = ''): StationBadgeInfo | null {
  if (!code?.trim()) return null
  const match = /^([A-Z]{1,2})(\d{2})$/.exec(normalizeStationCode(code))
  if (!match) return null
  const [, line, number] = match
  if (line.length === 2 && line.startsWith('J')) return { line, number, color: JR_EAST[line] ?? null, shape: 'square' }
  const osaka = /осак|osaka/i.test(city)
  const color = (osaka ? OSAKA : TOKYO)[line] ?? null
  return { line, number, color, shape: 'circle' }
}
