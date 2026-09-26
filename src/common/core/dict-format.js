/**
 * 词条渲染与收藏逻辑（纯 JS，**不含任何词库数据**）
 *
 * 为什么要单独一个文件：Vela 打包会把被 import 的模块**内联进每个页面的 jsc**，
 * 而词库有 650KB —— 页面一旦 import 带数据的 dict.js，每个页面的字节码都会各带一整份，
 * 真机上就是"打不开、一进就重启"（实测 lookup.jsc 794KB、app.jsc 546KB）。
 * 所以：页面只 import 这个纯逻辑文件，词库数据只由 app.ux 通过 dict.js 载入一份。
 */

const POS_NAME = {
  名: '名词', 动: '动词', 形: '形容词', 副: '副词', 介: '介词', 连: '连词',
  助: '助词', 代: '代词', 量: '量词', 数: '数词', 叹: '叹词', 兼: '兼词', 通: '通假'
}
const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮']

/** 用法串 '词性|今译|例句|出处; ...' → [{pos, items:[{g,ex,src}]}] */
export function parseUsage(text) {
  const out = []
  for (const part of String(text || '').split(';')) {
    const t = part.trim()
    if (!t) continue
    const f = t.split('|')
    const pos = (f[0] || '').trim()
    const g = (f[1] || '').trim()
    if (!g) continue
    const it = { g: g, ex: (f[2] || '').trim(), src: (f[3] || '').trim() }
    const last = out[out.length - 1]
    if (last && last.pos === pos) last.items.push(it)
    else out.push({ pos: pos, items: [it] })
  }
  return out
}

/** 解析好的词条直接给你分段块：页面只按 t（hd/pos/it）和 k/g/c 渲染 */
export function sections(entry) {
  if (!entry || !entry.groups || !entry.groups.length) return []
  const out = [{ t: 'hd', k: '', g: '用法（词性 · 今译 · 例句）', c: '' }]
  for (let i = 0; i < entry.groups.length; i++) {
    const grp = entry.groups[i]
    const name = POS_NAME[grp.pos]
    out.push({ t: 'pos', k: '', g: (i + 1) + '. ' + (name ? '作' + name : grp.pos), c: '' })
    for (let j = 0; j < grp.items.length; j++) {
      const it = grp.items[j]
      out.push({
        t: 'it',
        k: '',
        g: (NUM[j] || '(' + (j + 1) + ')') + ' ' + it.g,
        c: it.ex ? ('例：“' + it.ex + '”' + (it.src ? '（《' + it.src + '》）' : '')) : ''
      })
    }
  }
  return out
}

export function senseCount(entry) {
  if (!entry || !entry.groups) return 0
  let n = 0
  for (const g of entry.groups) n += g.items.length
  return n
}

/** 摘要：第一条今译 */
export function brief(entry) {
  if (!entry || !entry.groups || !entry.groups.length) return ''
  return entry.groups[0].items[0].g
}

/* ---------- 收藏 / 历史（纯逻辑，存档由 app.ux 负责） ---------- */

export function pushRecent(list, ch, max) {
  const cap = max || 60
  const out = [ch]
  for (let i = 0; i < list.length && out.length < cap; i++) {
    if (list[i] !== ch) out.push(list[i])
  }
  return out
}

export function toggleFav(list, ch) {
  const i = list.indexOf(ch)
  if (i >= 0) {
    const out = list.slice()
    out.splice(i, 1)
    return { list: out, added: false }
  }
  return { list: [ch].concat(list), added: true }
}

export function isFav(list, ch) { return list.indexOf(ch) >= 0 }
