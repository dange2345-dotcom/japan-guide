// Функция Supabase «jp-invite» — добавить человека в «Японию».
//
// Вызывает приложение с токеном вошедшего пользователя: { email, role: 'admin' | 'viewer', name }.
// Приглашать могут owner и admin. Если такого входа ещё нет — создаём его с временным паролем
// (регистрация в проекте закрыта: проект общий с «Планером») и возвращаем пароль один раз.
// Если вход уже есть — просто выдаём роль.
//
// Секрет функции (выставляет scripts/supabase-admin.ts): JP_SECRET_KEY. Выкладка: npm run supabase -- deploy

import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Не задан секрет ${name}`)
  return value
}

const admin = createClient(env('SUPABASE_URL'), env('JP_SECRET_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Пароль без похожих символов (0/O, 1/l) — его будут диктовать или пересылать. */
function makePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const user = data.users.find((u) => u.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 200) return null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Только POST' }, 405)
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Нужно войти' }, 401)
    const { data: caller, error: authError } = await admin.auth.getUser(token)
    if (authError || !caller.user) return json({ error: 'Сессия истекла — войдите заново' }, 401)

    const { data: me } = await admin.from('jp_members').select('role').eq('user_id', caller.user.id).maybeSingle()
    if (me?.role !== 'owner' && me?.role !== 'admin') return json({ error: 'Приглашать могут только владелец и администраторы' }, 403)

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const role = body.role
    const name = String(body.name ?? '').trim().slice(0, 60)
    if (!EMAIL.test(email)) return json({ error: 'Проверьте почту' }, 400)
    if (role !== 'admin' && role !== 'viewer') return json({ error: 'Роль: администратор или зритель' }, 400)

    let user = await findUserByEmail(email)
    let password: string | null = null
    if (!user) {
      password = makePassword()
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { invited_to: 'japan' } })
      if (error) throw error
      user = data.user
    }

    const { data: existing } = await admin.from('jp_members').select('role').eq('user_id', user.id).maybeSingle()
    if (existing?.role === 'owner') return json({ error: 'Это владелец — его роль не меняется' }, 400)

    const { data: member, error } = await admin
      .from('jp_members')
      .upsert({ user_id: user.id, email, name, role }, { onConflict: 'user_id' })
      .select('user_id, email, name, role, added_at')
      .single()
    if (error) throw error

    console.log(JSON.stringify({ invited: user.id, role, created: password !== null }))
    return json({ member, password })
  } catch (error) {
    console.error(error)
    return json({ error: String(error instanceof Error ? error.message : error) }, 500)
  }
})
