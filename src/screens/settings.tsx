import { useEffect, useState } from 'preact/hooks'
import { useApp } from '../app-context'
import { ROLE_LABEL, type Role } from '../data/access'
import { inviteMember, listMembers, removeMember, setMemberRole, type Member } from '../data/members'
import { useRows } from '../data/use-data'
import { humanizeError } from '../lib/errors'
import { useSyncState } from '../lib/hooks'
import { cachePhotos, countCachedPhotos } from '../lib/photos'
import { plural } from '../lib/plural'
import { useOnline } from '../lib/use-online'
import { ErrorText, Field, syncLabel } from '../ui/components'
import { IconCopy, IconDownload, IconOut, IconSync } from '../ui/icons'
import { formatBuildTime } from './gates'
import { PageHead } from './parts'

export function SettingsScreen() {
  const { email, role, client } = useApp()
  return (
    <>
      <PageHead title="Настройки" />
      <div class="settings">
        <OfflineCard />
        {client && (role === 'owner' || role === 'admin') && <MembersCard />}
        <AccountCard email={email} role={role} />
        <SyncCard />
      </div>
    </>
  )
}

/* ---------- Без сети ---------- */

function OfflineCard() {
  const places = useRows('places')
  const online = useOnline()
  const photos = (places ?? []).flatMap((p) => (p.photo ? [p.photo] : []))
  const [cached, setCached] = useState<number | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void countCachedPhotos(photos).then((n) => !cancelled && setCached(n))
    return () => {
      cancelled = true
    }
  }, [photos.length, progress === null])

  async function download() {
    setResult(null)
    setProgress({ done: 0, total: photos.length * 2 })
    const { failed } = await cachePhotos(photos, (done, total) => setProgress({ done, total }))
    setProgress(null)
    setResult(failed ? `Не скачалось файлов: ${failed}. Проверьте связь и нажмите ещё раз.` : 'Готово: всё откроется и без интернета.')
  }

  return (
    <section class="panel">
      <h2 class="panel__title">Без интернета</h2>
      <p class="panel__text">
        Места и гайды всегда хранятся на этом устройстве. Фото скачиваются, когда вы их открываете, — а эта кнопка скачает все сразу, например перед
        вылетом.
      </p>
      <dl class="facts">
        <div>
          <dt>Мест</dt>
          <dd class="num">{places?.length ?? '…'}</dd>
        </div>
        <div>
          <dt>Фото скачано</dt>
          <dd class="num">
            {cached ?? '…'} из {photos.length}
          </dd>
        </div>
      </dl>
      {progress ? (
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
          <div class="progress__fill" style={{ transform: `scaleX(${progress.total ? progress.done / progress.total : 1})` }} />
        </div>
      ) : (
        <button class="btn btn--primary" type="button" disabled={!online || photos.length === 0} onClick={() => void download()}>
          <IconDownload size={18} />
          Скачать всё для офлайна
        </button>
      )}
      {!online && <p class="hint">Сейчас нет сети — скачать не получится.</p>}
      {result && <p class="hint">{result}</p>}
    </section>
  )
}

/* ---------- Участники ---------- */

function MembersCard() {
  const { client, userId, role: myRole } = useApp()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  async function reload() {
    try {
      setMembers(await listMembers(client!))
      setError(null)
    } catch (err) {
      setError(humanizeError(err))
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function changeRole(member: Member, role: Exclude<Role, 'owner'>) {
    try {
      await setMemberRole(client!, member.user_id, role)
      await reload()
    } catch (err) {
      setError(humanizeError(err))
    }
  }

  async function remove(member: Member) {
    if (!confirm(`Убрать ${member.name || member.email} из участников? Человек больше не сможет открыть путеводитель.`)) return
    try {
      await removeMember(client!, member.user_id)
      await reload()
    } catch (err) {
      setError(humanizeError(err))
    }
  }

  return (
    <section class="panel">
      <h2 class="panel__title">Участники</h2>
      <p class="panel__text">Администратор добавляет и правит места, может приглашать других. Зритель только смотрит.</p>
      <ErrorText error={error} />
      {members === null && !error && <p class="hint">Загружаю…</p>}
      <ul class="members">
        {members?.map((m) => (
          <li class="member" key={m.user_id}>
            <div class="member__who">
              <span class="member__name">{m.name || m.email}</span>
              {m.name && <span class="member__email">{m.email}</span>}
            </div>
            {m.role === 'owner' || m.user_id === userId ? (
              <span class="member__role">{ROLE_LABEL[m.role]}</span>
            ) : (
              <div class="member__actions">
                <select
                  class="select"
                  aria-label={`Роль: ${m.email}`}
                  value={m.role}
                  onChange={(e) => void changeRole(m, e.currentTarget.value as Exclude<Role, 'owner'>)}
                >
                  <option value="admin">{ROLE_LABEL.admin}</option>
                  <option value="viewer">{ROLE_LABEL.viewer}</option>
                </select>
                {(myRole === 'owner' || m.role !== 'admin') && (
                  <button class="btn btn--ghost btn--small" type="button" onClick={() => void remove(m)}>
                    Убрать
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {inviting ? (
        <InviteForm onDone={() => void reload()} onClose={() => setInviting(false)} />
      ) : (
        <button class="btn" type="button" onClick={() => setInviting(true)}>
          Пригласить человека
        </button>
      )}
    </section>
  )
}

function InviteForm(props: { onDone: () => void; onClose: () => void }) {
  const { client } = useApp()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Exclude<Role, 'owner'>>('viewer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(event: Event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await inviteMember(client!, email, role, name)
      setCreated({ email: result.member.email, password: result.password })
      props.onDone()
    } catch (err) {
      setError(humanizeError(err))
    } finally {
      setBusy(false)
    }
  }

  const message = created?.password
    ? `Путеводитель по Японии: ${location.origin}${import.meta.env.BASE_URL}\nПочта: ${created.email}\nПароль: ${created.password}\nОткройте ссылку в Safari и добавьте на экран «Домой».`
    : ''

  if (created) {
    return (
      <div class="invite-done">
        {created.password ? (
          <>
            <p class="panel__text">
              Вход создан. Перешлите человеку ссылку, почту и пароль — пароль показывается <b>один раз</b>, сменить его можно в настройках.
            </p>
            <pre class="invite-done__message">{message}</pre>
            <button
              class="btn btn--primary"
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(message).then(() => setCopied(true))
              }}
            >
              <IconCopy size={18} />
              {copied ? 'Скопировано' : 'Скопировать сообщение'}
            </button>
          </>
        ) : (
          <p class="panel__text">Готово: у {created.email} уже был вход — доступ к путеводителю выдан, пароль прежний.</p>
        )}
        <button class="btn btn--ghost" type="button" onClick={props.onClose}>
          Закрыть
        </button>
      </div>
    )
  }

  return (
    <form class="invite" onSubmit={submit}>
      <Field label="Почта">
        <input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellcheck={false} required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
      </Field>
      <Field label="Имя (как подписать)">
        <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </Field>
      <div class="segmented" role="radiogroup" aria-label="Роль">
        {(['viewer', 'admin'] as const).map((r) => (
          <button type="button" role="radio" aria-checked={role === r} class={`segmented__item${role === r ? ' segmented__item--on' : ''}`} onClick={() => setRole(r)}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
      <div class="row-actions">
        <button class="btn btn--ghost" type="button" onClick={props.onClose}>
          Отмена
        </button>
        <button class="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Приглашаю…' : 'Пригласить'}
        </button>
      </div>
    </form>
  )
}

/* ---------- Аккаунт ---------- */

function AccountCard({ email, role }: { email: string | null; role: Role }) {
  const { client, signOut } = useApp()
  const [changing, setChanging] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function savePassword(event: Event) {
    event.preventDefault()
    if (!client) return
    setBusy(true)
    setError(null)
    try {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw error
      setMessage('Пароль изменён')
      setChanging(false)
      setPassword('')
    } catch (err) {
      setError(humanizeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="panel">
      <h2 class="panel__title">Аккаунт</h2>
      <dl class="facts">
        <div>
          <dt>Почта</dt>
          <dd>{email ?? '—'}</dd>
        </div>
        <div>
          <dt>Доступ</dt>
          <dd>{ROLE_LABEL[role]}</dd>
        </div>
      </dl>
      {message && <p class="hint">{message}</p>}
      {changing ? (
        <form class="invite" onSubmit={savePassword}>
          <Field label="Новый пароль" hint="Не короче 6 символов">
            <input type="password" autoComplete="new-password" minLength={6} required value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
          </Field>
          <ErrorText error={error} />
          <div class="row-actions">
            <button class="btn btn--ghost" type="button" onClick={() => setChanging(false)}>
              Отмена
            </button>
            <button class="btn btn--primary" type="submit" disabled={busy}>
              Сохранить
            </button>
          </div>
        </form>
      ) : (
        <div class="row-actions row-actions--start">
          {client && (
            <button class="btn" type="button" onClick={() => setChanging(true)}>
              Сменить пароль
            </button>
          )}
          <button class="btn btn--ghost" type="button" onClick={() => void signOut()}>
            <IconOut size={18} />
            Выйти
          </button>
        </div>
      )}
    </section>
  )
}

/* ---------- Синхронизация ---------- */

function SyncCard() {
  const { sync } = useApp()
  const state = useSyncState(sync)
  const label = syncLabel(state.status, state.pending)
  const last = state.lastSyncedAt ? new Date(state.lastSyncedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <section class="panel">
      <h2 class="panel__title">Синхронизация</h2>
      <dl class="facts">
        <div>
          <dt>Состояние</dt>
          <dd>{label.text}</dd>
        </div>
        <div>
          <dt>Последняя</dt>
          <dd class="num">{last ?? '—'}</dd>
        </div>
        {state.pending > 0 && (
          <div>
            <dt>Ждёт отправки</dt>
            <dd class="num">
              {state.pending} {plural(state.pending, 'изменение', 'изменения', 'изменений')}
            </dd>
          </div>
        )}
      </dl>
      {state.error && <p class="error">{state.error}</p>}
      <div class="row-actions row-actions--start">
        <button class="btn" type="button" onClick={() => void sync.sync()}>
          <IconSync size={18} />
          Синхронизировать сейчас
        </button>
      </div>
      <p class="hint">Версия от {formatBuildTime()}</p>
    </section>
  )
}
