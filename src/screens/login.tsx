import { useState } from 'preact/hooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import { humanizeError } from '../lib/errors'
import { ErrorText } from '../ui/components'

export function LoginScreen({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: Event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(humanizeError(error))
    } catch (err) {
      setError(humanizeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="gate">
      <form class="gate__card" onSubmit={onSubmit}>
        <BrandMark />
        <p class="gate__lead">Войдите, чтобы открыть свой путеводитель. Приглашённые входят с почтой и паролем, которые прислал владелец.</p>

        <label class="field">
          <span class="field__label">Почта</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellcheck={false}
            required
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </label>

        <label class="field">
          <span class="field__label">Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            required
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>

        <ErrorText error={error} />

        <button class="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}

/** Название приложения на экранах входа. */
export function BrandMark() {
  return (
    <div class="brand">
      <img class="brand__icon" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={56} height={56} />
      <div>
        <h1 class="brand__name">Япония</h1>
        <p class="brand__ja" lang="ja">
          日本ガイド
        </p>
      </div>
    </div>
  )
}
