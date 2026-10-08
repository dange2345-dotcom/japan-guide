// Роль текущего пользователя. Зрителю слой данных не даёт ничего записать (сервер тоже не пустит — RLS).

export type Role = 'owner' | 'admin' | 'viewer'

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  viewer: 'Зритель',
}

let current: Role | null = null

export function setRole(role: Role | null): void {
  current = role
}

export function getRole(): Role | null {
  return current
}

export function canEdit(role: Role | null = current): boolean {
  return role === 'owner' || role === 'admin'
}

export class ReadOnlyError extends Error {
  constructor() {
    super('Только просмотр: менять записи могут владелец и администраторы')
    this.name = 'ReadOnlyError'
  }
}

export function assertCanEdit(): void {
  if (!canEdit()) throw new ReadOnlyError()
}

export function isRole(value: unknown): value is Role {
  return value === 'owner' || value === 'admin' || value === 'viewer'
}
