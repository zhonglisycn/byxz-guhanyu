/**
 * 字体安全检查：词典里出现的字符，手环字体渲染得出来吗？
 *
 * 为什么要有这道检查：手环的中文字体只保证覆盖「基本集」（GB2312，6741 个汉字）。
 * 超出这个范围的字在屏幕上就是一个方框——用户看不懂，还以为是应用坏了。
 * 已经踩过一次：部首名用了康熙原形（辵 艸 貝 頁 門 車 見 馬 魚 鳥…），
 * 结果每条词条的"××部"都可能是方框。
 *
 * 检查对象是**成品数据**（src/common/data/lexicon.js）与页面模板，不是源文件——
 * 源文件里的繁体键只作别名用、不会显示，扫源文件会刷一屏假问题。
 *
 * 用法：node tools/check-font.mjs        # 有问题时退出码 1
 */
import fs from 'node:fs'
import path from 'node:path'
import { LEX } from '../src/common/data/lexicon.js'

/** GB2312 全部汉字：手环字体最保守的覆盖假设 */
function gb2312() {
  const out = new Set()
  for (let hi = 0xb0; hi <= 0xf7; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) {
      try { out.add(new TextDecoder('gb2312').decode(new Uint8Array([hi, lo]))) } catch (e) {}
    }
  }
  for (let hi = 0xa1; hi <= 0xa9; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) {
      try { out.add(new TextDecoder('gb2312').decode(new Uint8Array([hi, lo]))) } catch (e) {}
    }
  }
  return out
}

const SAFE = gb2312()
const isHan = (c) => c >= '\u3400' && c <= '\u9fff'
const bad = (text) => {
  const out = new Set()
  for (const c of text) if (isHan(c) && !SAFE.has(c)) out.add(c)
  return Array.from(out)
}

let problems = 0
const report = (where, chars, sample) => {
  if (!chars.length) return
  problems++
  console.log('  ✗ ' + where)
  console.log('    ' + chars.map((c) => c + '(U+' + c.codePointAt(0).toString(16).toUpperCase() + ')').join(' '))
  if (sample) console.log('    例如：' + sample)
}

// ① 词库正文（字头 + 拼音 + 部首 + 用法串）——这些一定会显示
const headBad = []
const radicalBad = []
const bodyBad = []
let sample = ''
for (const h in LEX) {
  const e = LEX[h]
  const hb = bad(h)
  if (hb.length) headBad.push(...hb)
  // 部首字段单独看（它来自康熙部首表，最容易带出生僻字形）
  const rb = bad(e[1] || '')
  if (rb.length && radicalBad.length < 40) radicalBad.push(e[1] + '(' + h + ')')
  const bb = bad(e[0] + ' ' + e[3])
  if (bb.length) { bodyBad.push(...bb); if (!sample) sample = h + '：' + String(e[3]).slice(0, 60) }
}
report('字头里有渲染不出的字', Array.from(new Set(headBad)))
report('部首名里有渲染不出的字（' + radicalBad.length + ' 个词条受影响）', Array.from(new Set(radicalBad.map((x) => x[0]))), radicalBad.slice(0, 6).join(' '))
report('用法正文（今译/例句/出处）里有渲染不出的字', Array.from(new Set(bodyBad)), sample)

// ② 页面模板里的固定文案
for (const dir of ['src/pages', 'src']) {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'components') walk(p); continue }
      if (!/\.(ux|css)$/.test(e.name)) continue
      const text = fs.readFileSync(p, 'utf8')
      const b = bad(text)
      report('页面文案 ' + p.replace(/\\/g, '/'), b)
    }
  }
  walk(dir)
}

if (!problems) {
  console.log('字体安全检查通过：所有会显示的汉字都在 GB2312 内（共检查 ' + Object.keys(LEX).length + ' 个词条）')
} else {
  console.log('\n共 ' + problems + ' 处问题。修法：换用常用字形/常用词，或删掉那个义项。')
  process.exit(1)
}
