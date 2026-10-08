import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '../config'
import { isRole, type Role } from './access'

// Участники хранятся не в jp_records, а в отдельной таблице jp_members (роль решает доступ на сервере).

export interface Member {
  user_id: string
  email: string
  name: string
  role: Role
  added_at: string
}

/** Роль текущего пользователя с сервера: null — не участник; undefined — сервер недоступен. */
export async function fetchMyRole(client: SupabaseClient, userId: string): Promise<Role | null | undefined> {
  try {
    const { data, error } = await client.from('jp_members').select('role').eq('user_id', userId).maybeSingle()
    if (error) return undefined
    return data && isRole(data.role) ? data.role : null
  } catch {
    return undefined
  }
}

export async function listMembers(client: SupabaseClient): Promise<Member[]> {
  const { data, error } = await client.from('jp_members').select('user_id, email, name, role, added_at').order('added_at')
  if (error) throw error
  return (data as Member[]).filter((m) => isRole(m.role))
}

export async function setMemberRole(client: SupabaseClient, userId: string, role: Exclude<Role, 'owner'>): Promise<void> {
  const { error } = await client.from('jp_members').update({ role }).eq('user_id', userId)
  if (error) throw error
}

export async function removeMember(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('jp_members').delete().eq('user_id', userId)
  if (error) throw error
}

export interface InviteResult {
  /** Новый пользователь — временный пароль, показать один раз. Уже был в системе — null. */
  password: string | null
  member: Member
}

/** Пригласить человека (функция jp-invite создаёт вход и запись участника). */
export async function inviteMember(client: SupabaseClient, email: string, role: Exclude<Role, 'owner'>, name: string): Promise<InviteResult> {
  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Сессия истекла — войдите заново')
  const response = await fetch(`${SUPABASE_URL}/functions/v1/jp-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: email.trim().toLowerCase(), role, name: name.trim() }),
  })
  const body = (await response.json().catch(() => ({}))) as Partial<InviteResult> & { error?: string }
  if (!response.ok || !body.member) throw new Error(body.error || `Ошибка ${response.status}`)
  return { password: body.password ?? null, member: body.member }
}
