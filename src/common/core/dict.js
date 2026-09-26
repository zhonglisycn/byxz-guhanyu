/**
 * 词库内核（数据层，纯 JS，可在 Node 里单测）
 *
 * **只有 app.ux 该 import 这个文件**：它把 650KB 的词库数据带进来，
 * Vela 打包会把模块内联进每个 import 它的页面的 jsc —— 页面若 import 它，
 * 每个页面都各带一整份词库，真机会"打不开、一进就重启"。
 * 页面需要的渲染逻辑在 dict-format.js（不含数据）。
 *
 * 数据形态：LEX[字头] = [拼音, 部首, 笔画, 用法串]
 *   用法串：'词性|今译|例句|出处; ...'（例句、出处可省）
 */
import { LEX, ALIAS, PY, META } from '../data/lexicon.js'
import { parseUsage } from './dict-format.js'

// 纯逻辑继续从这里转出（老引用不必改）
export { sections, senseCount, brief, pushRecent, toggleFav, isFav, parseUsage } from './dict-format.js'

export function ready() { return !!(LEX && META && META.count > 0) }
export function total() { return ready() ? META.count : 0 }
export function stats() { return ready() ? META : { count: 0, alias: 0, pinyinKeys: 0, sources: [] } }

/** 别的写法（繁体/异体）→ 字头 */
export function aliasOf(ch) {
  if (!ready() || !ALIAS) return null
  const a = ALIAS[ch]
  return a ? [a] : null
}

/** 查字：先按字头，再按别名。返回词条对象或 null */
export function entryOf(ch) {
  if (!ready() || !ch) return null
  let head = ch
  if (LEX[head] === undefined && ALIAS && ALIAS[head] !== undefined) head = ALIAS[head]
  const raw = LEX[head]
  if (raw === undefined) return null
  return {
    h: head,
    y: raw[0] || '',
    r: raw[1] || '',
    b: raw[2] || 0,
    groups: parseUsage(raw[3]),
    asked: ch
  }
}

/** 拼音查字：返回字头数组（写作顺序即常用度，写在前面的就是常用字） */
export function pinyinSearch(key) {
  if (!ready() || !PY) return null
  const k = String(key || '').trim().toLowerCase()
  if (!k) return null
  return PY[k] || null
}

export function sourceText() {
  return ready() ? META.sources.join('\n') : ''
}
