import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Role } from './data/access'
import type { JapanDB } from './db/db'
import type { SyncEngine } from './sync/engine'

export interface AppContextValue {
  db: JapanDB
  sync: SyncEngine
  /** null — демо-режим без облака. */
  client: SupabaseClient | null
  userId: string
  email: string | null
  role: Role
  canEdit: boolean
  signOut: () => Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('AppContext не задан')
  return value
}
