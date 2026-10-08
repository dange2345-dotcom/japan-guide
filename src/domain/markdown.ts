// Простой markdown для гайдов → дерево блоков (а не HTML-строка): экран рисует его компонентами,
// поэтому никакой текст не может внедрить разметку или скрипт.
//
// Поддерживается: # заголовки (1–3), абзацы, списки «-», «*», «1.», чек-листы «- [ ]», цитаты «>»,
// линия «---», таблицы «| a | b |»; внутри строки — **жирный**, *курсив*, `код`, [текст](ссылка) и голые ссылки.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: { checked: boolean | null; children: Inline[] }[] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'rule' }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }

const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, children: parseInline(heading[2]) })
      i++
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'rule' })
      i++
      continue
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) tableLines.push(lines[i++].trim())
      // Строка-разделитель «|---|:--:|» — не данные.
      const cells = tableLines.filter((l) => /[^\s|:-]/.test(l)).map(splitRow)
      if (cells.length > 0) blocks.push({ type: 'table', head: cells[0].map(parseInline), rows: cells.slice(1).map((r) => r.map(parseInline)) })
      continue
    }

    if (trimmed.startsWith('>')) {
      const parts: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) parts.push(lines[i++].trim().replace(/^>\s?/, ''))
      blocks.push({ type: 'quote', children: parseInline(parts.join(' ')) })
      continue
    }

    const listMatch = /^([-*•]|\d+[.)])\s+/.exec(trimmed)
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1])
      const items: { checked: boolean | null; children: Inline[] }[] = []
      while (i < lines.length) {
        const current = lines[i].trim()
        const m = /^([-*•]|\d+[.)])\s+(.*)$/.exec(current)
        if (!m || /\d/.test(m[1]) !== ordered) break
        const check = /^\[( |x|X)\]\s+(.*)$/.exec(m[2])
        items.push(check ? { checked: check[1] !== ' ', children: parseInline(check[2]) } : { checked: null, children: parseInline(m[2]) })
        i++
        // Продолжение пункта на следующей строке с отступом.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
          items[items.length - 1].children.push({ type: 'text', text: ' ' }, ...parseInline(lines[i].trim()))
          i++
        }
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const parts: string[] = []
    while (i < lines.length) {
      const current = lines[i].trim()
      if (!current || /^(#{1,3}\s|>|\||([-*•]|\d+[.)])\s)/.test(current) || /^(-{3,}|\*{3,}|_{3,})$/.test(current)) break
      parts.push(current)
      i++
    }
    blocks.push({ type: 'paragraph', children: parseInline(parts.join(' ')) })
  }

  return blocks
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let rest = text
  // Порядок важен: код, ссылка, жирный, курсив, голая ссылка.
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?»"'])/

  while (rest) {
    const match = pattern.exec(rest)
    if (!match) {
      out.push({ type: 'text', text: rest })
      break
    }
    if (match.index > 0) out.push({ type: 'text', text: rest.slice(0, match.index) })
    const [token] = match
    if (match[1]) {
      out.push({ type: 'code', text: token.slice(1, -1) })
    } else if (match[2]) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!
      out.push(SAFE_URL.test(m[2]) ? { type: 'link', href: m[2], children: parseInline(m[1]) } : { type: 'text', text: m[1] })
    } else if (match[3]) {
      out.push({ type: 'strong', children: parseInline(token.slice(2, -2)) })
    } else if (match[4]) {
      out.push({ type: 'em', children: parseInline(token.slice(1, -1)) })
    } else {
      out.push({ type: 'link', href: token, children: [{ type: 'text', text: shortUrl(token) }] })
    }
    rest = rest.slice(match.index + token.length)
  }

  return out
}

/** «https://www.japan-guide.com/e/e2361.html» → «japan-guide.com/e/e2361.html» (без протокола и www). */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

/** Первые слова текста без разметки — для превью в списке. */
export function plainExcerpt(source: string, max = 140): string {
  const text = source
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>|]/g, '')
    .replace(/^\s*([-•]|\d+[.)])\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text
}
