import { Lexer, type MarkedToken, type Token, type Tokens } from 'marked'
import { decodeHTML } from 'entities'

function htmlText(source: string): string {
  return decodeHTML(source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|tr|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<(?:[^'">]|"[^"]*"|'[^']*')*>/g, ''))
}

function inline(tokens: Token[]): string {
  return tokens.map(raw => {
    const token = raw as MarkedToken
    switch (token.type) {
      case 'strong': case 'em': case 'del': return inline(token.tokens)
      case 'text': return token.tokens ? inline(token.tokens) : decodeHTML(token.text)
      case 'escape': case 'codespan': return token.text
      case 'link': {
        const label = inline(token.tokens)
        const url = token.autolink ? token.href : decodeHTML(token.href)
        return !label || label === url || `mailto:${label}` === url ? url.replace(/^mailto:/i, '') : `${label}（${url}）`
      }
      case 'image': return inline(token.tokens)
      case 'br': return '\n'
      case 'html': return htmlText(token.text)
      case 'checkbox': return ''
      default: return 'text' in token ? token.text : ''
    }
  }).join('')
}

function blocks(tokens: Token[]): string {
  return tokens.map(raw => {
    const token = raw as MarkedToken
    switch (token.type) {
      case 'heading': case 'paragraph': case 'text':
        return (token.tokens ? inline(token.tokens) : decodeHTML(token.text)) + '\n\n'
      case 'code': return token.text + '\n\n'
      case 'blockquote': return blocks(token.tokens)
      case 'list': return token.items.map(item => blocks(item.tokens).replace(/\n+$/, '')).join('\n') + '\n\n'
      case 'table': {
        const row = (cells: Tokens.TableCell[]) => cells.map(cell => inline(cell.tokens).replace(/\n/g, ' ')).join('\t')
        return [row(token.header), ...token.rows.map(row)].join('\n') + '\n\n'
      }
      case 'html': return htmlText(token.text) + '\n\n'
      case 'space': case 'hr': case 'def': return ''
      default: return inline([token])
    }
  }).join('')
}

export function markdownToText(source: string): string {
  // Read tokens directly; user-supplied Markdown and HTML are never rendered or executed.
  return blocks(Lexer.lex(source, { gfm: true })).replace(/^\n+|\n+$/g, '')
}
