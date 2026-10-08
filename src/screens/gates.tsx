import { BrandMark } from './login'

export function NotConfiguredScreen() {
  return (
    <main class="gate">
      <section class="gate__card">
        <BrandMark />
        <p class="gate__lead">Приложение установлено, но облако для данных ещё не подключено.</p>
        <p class="hint">Сборка: {formatBuildTime()}</p>
      </section>
    </main>
  )
}

/** Вошли, но человек не участник (или первый вход без сети — роль ещё неизвестна). */
export function NoAccessScreen(props: { email: string; offline: boolean; onSignOut: () => void }) {
  return (
    <main class="gate">
      <section class="gate__card">
        <BrandMark />
        {props.offline ? (
          <p class="gate__lead">Для первого входа нужен интернет: приложение должно узнать, какой у вас доступ. Подключитесь и откройте его снова.</p>
        ) : (
          <p class="gate__lead">
            У <b>{props.email}</b> нет доступа к этому путеводителю. Попросите владельца пригласить вас по этой почте.
          </p>
        )}
        <button class="btn" type="button" onClick={props.onSignOut}>
          Выйти
        </button>
      </section>
    </main>
  )
}

export function formatBuildTime(): string {
  return new Date(__BUILD_TIME__).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
