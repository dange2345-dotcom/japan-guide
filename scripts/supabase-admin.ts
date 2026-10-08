// Настройка облака Supabase через Management API — для Claude, с токеном владельца.
// Проект общий с «Планером»: здесь трогаем только объекты «Японии» (jp_*, хранилище jp-photos, функция jp-invite).
//
//   npm run supabase -- schema           выполнить supabase/schema.sql (таблицы, права, хранилище фото)
//   npm run supabase -- secrets          секрет функции jp-invite (секретный ключ из .env)
//   npm run supabase -- deploy           выложить функцию jp-invite (supabase/functions/jp-invite)
//   npm run supabase -- sql "select …"   выполнить SQL
//
// Токен: SUPABASE_ACCESS_TOKEN=sbp_… в japan-guide/.env (Supabase → Account → Access Tokens).
// Ни токен, ни ключи не выводить в консоль и не коммитить.

import { readFileSync, existsSync } from 'node:fs'
import { SUPABASE_URL } from '../src/config'

const root = new URL('../', import.meta.url)
const PROJECT = new URL(SUPABASE_URL).hostname.split('.')[0]
const API = `https://api.supabase.com/v1/projects/${PROJECT}`
const FUNCTION = 'jp-invite'
const FUNCTION_FILES = ['index.ts']

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const envFile = new URL('.env', root)
if (existsSync(envFile)) process.loadEnvFile(envFile)

function need(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) fail(`Нет ${name} в japan-guide/.env`)
  return value
}

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const token = need('SUPABASE_ACCESS_TOKEN')
  if (!token.startsWith('sbp_')) fail('SUPABASE_ACCESS_TOKEN должен начинаться с sbp_')
  const isForm = body instanceof FormData
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) fail(`${method} ${path}: ${response.status} ${text.slice(0, 500)}`)
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return text
  }
}

const sql = (query: string) => api('POST', '/database/query', { query })

const [command, arg] = process.argv.slice(2)

switch (command) {
  case 'schema': {
    await sql(readFileSync(new URL('supabase/schema.sql', root), 'utf8'))
    const tables = await sql(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name like 'jp\\_%' order by 1`,
    )
    console.log('✔ Схема выполнена. Таблицы:', tables.map((t: { table_name: string }) => t.table_name).join(', '))
    break
  }

  case 'secrets': {
    await api('POST', '/secrets', [{ name: 'JP_SECRET_KEY', value: need('SUPABASE_SECRET_KEY') }])
    console.log('✔ Секрет функции выставлен')
    break
  }

  case 'deploy': {
    const form = new FormData()
    // JWT проверяет сама функция (auth.getUser) — так работает и с новыми ключами подписи.
    form.append('metadata', JSON.stringify({ name: FUNCTION, entrypoint_path: 'index.ts', verify_jwt: false }))
    for (const name of FUNCTION_FILES) {
      const content = readFileSync(new URL(`supabase/functions/${FUNCTION}/${name}`, root))
      form.append('file', new Blob([content], { type: 'application/typescript' }), name)
    }
    const result = await api('POST', `/functions/deploy?slug=${FUNCTION}`, form)
    console.log(`✔ Функция выложена: ${FUNCTION}, версия ${result?.version ?? '?'}, статус ${result?.status ?? '?'}`)
    break
  }

  case 'sql': {
    if (!arg) fail('Нужен текст запроса')
    console.log(JSON.stringify(await sql(arg), null, 1))
    break
  }

  default:
    fail('Команды: schema, secrets, deploy, sql')
}
