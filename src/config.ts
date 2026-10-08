// Адрес проекта Supabase и его публичный ключ — тот же проект, что у «Планера» (таблицы «Японии» с префиксом jp_).
// Ключ публичный по задумке Supabase: доступ закрыт входом по паролю и правилами RLS (см. supabase/schema.sql),
// поэтому хранить его в открытом репозитории безопасно. Секретный ключ (secret / service_role) сюда класть НЕЛЬЗЯ.
export const SUPABASE_URL = 'https://cswqkcgmjlulvjojkjqz.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_hYW2_g6JOtHPam97IEgs1g_cxYpDp5f'

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

/** Хранилище фото мест (публичное чтение по ссылке). */
export const PHOTO_BUCKET = 'jp-photos'

/** Адрес фото по пути в хранилище. Полный адрес (демо, только что выбранный файл) — как есть. */
export function photoUrl(path: string): string {
  if (/^(https?:|blob:|data:)/.test(path)) return path
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
}
