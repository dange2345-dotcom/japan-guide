import { render } from 'preact'
import { App } from './app'
import { trackNavigation } from './lib/hooks'
import { startUpdates } from './lib/updates'
import '@fontsource/fira-sans/latin-400.css'
import '@fontsource/fira-sans/cyrillic-400.css'
import '@fontsource/fira-sans/latin-500.css'
import '@fontsource/fira-sans/cyrillic-500.css'
import '@fontsource/fira-sans/latin-700.css'
import '@fontsource/fira-sans/cyrillic-700.css'
import '@fontsource/fira-sans/latin-800.css'
import '@fontsource/fira-sans/cyrillic-800.css'
import './styles.css'

// Просим браузер не вычищать локальную базу и фото при нехватке места — в поездке они нужны без сети.
navigator.storage?.persist?.().catch(() => {})
trackNavigation()
startUpdates()

const root = document.getElementById('app')!

if (import.meta.env.VITE_DEMO === '1') {
  import('./demo').then(({ DemoApp }) => render(<DemoApp />, root))
} else {
  render(<App />, root)
}
