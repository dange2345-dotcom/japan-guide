import type { Block, Inline } from '../domain/markdown'

// Рисует дерево markdown компонентами — без innerHTML, поэтому текст гайда не может внедрить разметку.

export function InlineText({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return node.text
          case 'strong':
            return (
              <strong key={i}>
                <InlineText nodes={node.children} />
              </strong>
            )
          case 'em':
            return (
              <em key={i}>
                <InlineText nodes={node.children} />
              </em>
            )
          case 'code':
            return <code key={i}>{node.text}</code>
          case 'link':
            return (
              <a key={i} href={node.href} target="_blank" rel="noopener noreferrer">
                <InlineText nodes={node.children} />
              </a>
            )
        }
      })}
    </>
  )
}

export function MarkdownView({ blocks }: { blocks: Block[] }) {
  return (
    <div class="prose">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const Tag = (['h2', 'h3', 'h4'] as const)[block.level - 1]
            return (
              <Tag key={i}>
                <InlineText nodes={block.children} />
              </Tag>
            )
          }
          case 'paragraph':
            return (
              <p key={i}>
                <InlineText nodes={block.children} />
              </p>
            )
          case 'quote':
            return (
              <blockquote key={i}>
                <InlineText nodes={block.children} />
              </blockquote>
            )
          case 'rule':
            return <hr key={i} />
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul'
            const checklist = block.items.some((item) => item.checked !== null)
            return (
              <Tag key={i} class={checklist ? 'checklist' : undefined}>
                {block.items.map((item, j) => (
                  <li key={j} class={item.checked ? 'is-checked' : undefined}>
                    {item.checked !== null && <span class={`checkbox${item.checked ? ' checkbox--on' : ''}`} aria-label={item.checked ? 'сделано' : 'не сделано'} />}
                    <span>
                      <InlineText nodes={item.children} />
                    </span>
                  </li>
                ))}
              </Tag>
            )
          }
          case 'table':
            return (
              <div class="table-wrap" key={i}>
                <table>
                  <thead>
                    <tr>
                      {block.head.map((cell, j) => (
                        <th key={j}>
                          <InlineText nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>
                            <InlineText nodes={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </div>
  )
}
