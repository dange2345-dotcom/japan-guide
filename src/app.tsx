import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { AppContext, type AppContextValue } from './app-context'
import { canEdit, isRole, setRole, type Role } from './data/access'
import { fetchMyRole } from './data/members'
import { clearAll, createDb } from './db/db'
import { supabase } from './supabase'
import { createSyncEngine } from './sync/engine'
import { supabaseRemote } from './sync/remote'
import { LoginScreen } from './screens/login'
import { NoAccessScreen, NotConfiguredScreen } from './screens/gates'
import { Shell } from './screens/shell'

const db = createDb('japan')

export function App() {
  return supabase ? <AuthGate client={supabase} /> : <NotConfiguredScreen />
}

function AuthGate({ client }: { client: SupabaseClient }) {
  // undefined — ещё не знаем (читаем сохранённую сессию), null — не вошли.
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [client])

  if (session === undefined) return null
  return session ? <Member client={client} session={session} /> : <LoginScreen client={client} />
}

/** Роль: с сервера, а без сети — запомненная на устройстве. 'none' — не участник, 'offline' — первый вход без сети. */
type RoleState = Role | 'none' | 'offline' | undefined

function Member({ client, session }: { client: SupabaseClient; session: Session }) {
  const userId = session.user.id
  const [role, setRoleState] = useState<RoleState>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // На устройство вошёл другой аккаунт — чужие локальные данные стираем.
      const owner = await db.meta.get('userId')
      if (owner && owner.value !== userId) await clearAll(db)
      await db.meta.put({ key: 'userId', value: userId })

      const cached = (await db.meta.get('role'))?.value
      if (isRole(cached) && !cancelled) setRoleState(cached)

      const fresh = await fetchMyRole(client, userId)
      if (cancelled) return
      if (fresh === undefined) {
        if (!isRole(cached)) setRoleState('offline')
        return
      }
      if (fresh === null) {
        await db.meta.delete('role')
        setRoleState('none')
        return
      }
      await db.meta.put({ key: 'role', value: fresh })
      setRoleState(fresh)
    })()
    return () => {
      cancelled = true
    }
  }, [client, userId])

  const signOut = async () => {
    await clearAll(db)
    // Только это устройство: сессии «Планера» и других устройств не трогаем.
    await client.auth.signOut({ scope: 'local' })
  }

  if (role === undefined) return null
  if (role === 'none' || role === 'offline') return <NoAccessScreen email={session.user.email ?? ''} offline={role === 'offline'} onSignOut={signOut} />
  return <Workspace client={client} session={session} role={role} />
}

function Workspace({ client, session, role }: { client: SupabaseClient; session: Session; role: Role }) {
  const engine = useMemo(() => createSyncEngine(db, supabaseRemote(client)), [client])
  const stop = useRef<(() => void) | null>(null)
  setRole(role)

  useEffect(() => {
    stop.current = engine.start()
    return () => {
      stop.current?.()
      stop.current = null
    }
  }, [engine])

  const context = useMemo<AppContextValue>(
    () => ({
      db,
      sync: engine,
      client,
      userId: session.user.id,
      email: session.user.email ?? null,
      role,
      canEdit: canEdit(role),
      async signOut() {
        await engine.sync()
        const pending = engine.getState().pending
        if (pending > 0 && !confirm(`${pending} изм. ещё не отправлено в облако (нет связи) и пропадёт. Всё равно выйти?`)) return
        stop.current?.()
        stop.current = null
        await clearAll(db)
        await client.auth.signOut({ scope: 'local' })
      },
    }),
    [engine, client, session.user.id, session.user.email, role],
  )

  return (
    <AppContext.Provider value={context}>
      <Shell />
    </AppContext.Provider>
  )
}
