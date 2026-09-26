/**
 * 把人工撰写的词条（src/common/data/words.js）编译成应用用的词库。
 *
 * 做三件事：
 *   ① 从 Unihan 补拼音 / 部首 / 笔画（不用手写，也就不会写错）；
 *   ② 字头归一到"用户会打的字形"：作者可能写的是繁体（給/當/說），
 *      用 Unihan kSimplifiedVariant 归一成简体，繁体写法留作别名；
 *   ③ 生成拼音索引（带调 + 无调，ü→v/u 都认）与校验报告。
 *
 * 用法：node tools/build-words.mjs [--unihan <目录>] [--out <文件>]
 */
import fs from 'node:fs'
import path from 'node:path'
import fs0 from 'node:fs'
// 词条正文可以分成多个文件写（words.js / words2.js / …），按文件名顺序合并。
// 这样补词条只是新增一个文件，不用改动已有文件、也不会碰坏它。
const DATA_DIR = 'src/common/data'
const wordFiles = fs0.readdirSync(DATA_DIR)
  .filter((f) => /^words\d*\.js$/.test(f))
  .sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 1) - (parseInt(b.replace(/\D/g, ''), 10) || 1))
const WORDS = {}
for (const f of wordFiles) {
  const m = await import('../' + DATA_DIR + '/' + f)
  for (const k in m.WORDS) WORDS[k] = m.WORDS[k]
}
console.log('词条文件：' + wordFiles.join(' '))

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const UH = arg('unihan', 'C:/Users/39830/AppData/Local/Temp/kx/unihan')
const OUT = arg('out', 'src/common/data/lexicon.js')

const KANGXI_RADICALS =
  '一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨靑非面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠'
const RAD = Array.from(KANGXI_RADICALS)
if (RAD.length !== 214) throw new Error('康熙部首表长度应为 214，实为 ' + RAD.length)

// 康熙部首表用的是旧字形（戶 艸 辵 貝 頁 門 車 見 馬 魚 鳥 長 風 飛 齊 麥 黃 靑 襾…），
// 这些字绝大多数手环字体里没有，显示出来就是方框——页面上"××部"会变成"□部"。
// 所以显示时换成现代字形（多为简化部首）；实在没有对应字形的就干脆不显示部首。
const RAD_SHOW = {
  戶: '户', 艸: '艹', 辵: '辶', 貝: '贝', 頁: '页', 門: '门', 車: '车', 見: '见',
  馬: '马', 魚: '鱼', 鳥: '鸟', 長: '长', 風: '风', 飛: '飞', 齊: '齐', 麥: '麦',
  黃: '黄', 靑: '青', 襾: '西', 匸: '匚', 夊: '夂', 釆: '采',
  // 亅 癶 禸 没有可替代的常用字形，不显示
  亅: '', 癶: '', 禸: ''
}

/* ---------- 读 Unihan ---------- */
const uni = new Map()
const TRAD_OF = {}   // 简体字 → 它的繁体写法（由 Unihan kSimplifiedVariant 反推）
const slot = (c) => {
  let o = uni.get(c)
  if (!o) { o = {}; uni.set(c, o) }
  return o
}
const chr = (code) => String.fromCodePoint(parseInt(code.slice(2), 16))
const hasUH = fs.existsSync(path.join(UH, 'Unihan_Readings.txt'))
if (!hasUH) console.log('⚠ 没找到 Unihan 目录（' + UH + '），拼音/部首/笔画会缺失')
if (hasUH) {
  for (const line of fs.readFileSync(path.join(UH, 'Unihan_Readings.txt'), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue
    const f = line.split('\t')
    if (f.length < 3) continue
    const o = slot(chr(f[0]))
    if (f[1] === 'kMandarin') o.y = f[2].trim()
    else if (f[1] === 'kHanyuPinyin' && !o.y) {
      const m = /:([a-zA-Zü\u00c0-\u01ff]+)\d/.exec(f[2])
      if (m) o.y = m[1]
    }
  }
  for (const line of fs.readFileSync(path.join(UH, 'Unihan_IRGSources.txt'), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue
    const f = line.split('\t')
    if (f.length < 3) continue
    if (f[1] === 'kRSUnicode') {
      const n = parseInt(f[2].replace(/'/g, '').split('.')[0], 10)
      if (n >= 1 && n <= 214) {
        const rad = RAD[n - 1]
        slot(chr(f[0])).r = RAD_SHOW[rad] !== undefined ? RAD_SHOW[rad] : rad
      }
    } else if (f[1] === 'kTotalStrokes') slot(chr(f[0])).b = parseInt(f[2].split(' ')[0], 10)
  }
  for (const line of fs.readFileSync(path.join(UH, 'Unihan_Variants.txt'), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue
    const f = line.split('\t')
    if (f.length < 3) continue
    const o = slot(chr(f[0]))
    if (f[1] === 'kSimplifiedVariant') {
      const m = /^U\+([0-9A-F]+)/.exec(f[2])
      if (m && !o.s) o.s = String.fromCodePoint(parseInt(m[1], 16))
      // 反向记：谁把某字当简体，谁就是它的繁体写法（复词转繁体要用这个）
      if (m) {
        const simp = String.fromCodePoint(parseInt(m[1], 16))
        if (TRAD_OF[simp] === undefined) TRAD_OF[simp] = chr(f[0])
      }
    } else if (f[1] === 'kTraditionalVariant') {
      if (!o.t) o.t = []
      for (const one of f[2].split(' ')) {
        const m = /^U\+([0-9A-F]+)/.exec(one)
        if (m) o.t.push(String.fromCodePoint(parseInt(m[1], 16)))
      }
    }
  }
}

/* ---------- 归一 + 合并 ---------- */
const LEX = {}       // 简体字头 → [拼音, 部首, 笔画, 用法串]
const ALIAS = {}     // 别的写法 → 字头
const dupes = []
const noPinyin = []
// 单字归一成简体；复词（如「妻子」「须臾」）逐字归一
function toSimp(ch) {
  const o = uni.get(ch)
  if (hasUH && o && o.s && o.s.length === 1) return o.s
  return ch
}
for (const key in WORDS) {
  const v = WORDS[key]
  if (!v || typeof v !== 'string') continue
  const isWord = Array.from(key).length > 1
  let head = ''
  for (const ch of key) head += toSimp(ch)
  if (LEX[head] !== undefined) { dupes.push(key + '→' + head); continue }
  const u = uni.get(key) || {}
  if (isWord) {
    // 复词：拼音按字拼起来（记得住、也能整词查），部首笔画留空
    const py = []
    let miss = false
    for (const ch of head) {
      const o = uni.get(ch) || {}
      if (o.y) py.push(o.y)
      else miss = true
    }
    if (miss || !py.length) noPinyin.push(head)
    LEX[head] = [py.join(' '), '', 0, v]
    if (key !== head) ALIAS[key] = head
    // 复词的繁体写法逐字转（须臾 → 須臾），用户打繁体也能查到
    let trad = ''
    let diff = false
    for (const ch of head) {
      const o = uni.get(ch) || {}
      const t = TRAD_OF[ch] || (o.t && o.t.length ? o.t[0] : ch)
      if (t !== ch) diff = true
      trad += t
    }
    if (diff && trad !== head && LEX[trad] === undefined && ALIAS[trad] === undefined) ALIAS[trad] = head
    continue
  }
  const hu = uni.get(head) || u
  if (!hu.y) noPinyin.push(head)
  LEX[head] = [hu.y || '', hu.r || '', hu.b || 0, v]
  // 别名：原字形（若与字头不同）+ 该字的繁体写法
  if (key !== head) ALIAS[key] = head
  const hs = uni.get(head) || {}
  if (hs.t) for (const t of hs.t) if (t !== head && LEX[t] === undefined && ALIAS[t] === undefined) ALIAS[t] = head
  if (u.t) for (const t of u.t) if (t !== head && ALIAS[t] === undefined) ALIAS[t] = head
}
// 别名不能盖住已有字头
for (const a in ALIAS) if (LEX[a] !== undefined) delete ALIAS[a]

/* ---------- 拼音索引 ---------- */
const TONE = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a', a: 'a', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', o: 'o',
  ē: 'e', é: 'e', ě: 'e', è: 'e', e: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i', i: 'i',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', u: 'u', ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
  ń: 'n', ň: 'n', ǹ: 'n', ḿ: 'm'
}
const PY = {}
const pyAdd = (k, h) => {
  const key = String(k).trim().toLowerCase()
  if (!key) return
  if (!PY[key]) PY[key] = []
  if (PY[key].indexOf(h) < 0) PY[key].push(h)
}
for (const h in LEX) {
  const y = LEX[h][0]
  if (!y) continue
  // 复词：'xū yú' 既能让整个词可查，也去掉空格给"xuyu"建一个键
  const whole = y.replace(/\s+/g, '')
  let wholePlain = ''
  for (const c of whole.trim().toLowerCase()) wholePlain += (TONE[c] !== undefined ? TONE[c] : c)
  if (whole.indexOf(' ') >= 0 || Array.from(h).length > 1) {
    pyAdd(whole, h)
    pyAdd(wholePlain, h)
  }
  for (const one of y.split(/[,/ ]+/)) {
    if (!one) continue
    let plain = ''
    for (const c of one.trim().toLowerCase()) plain += (TONE[c] !== undefined ? TONE[c] : c)
    pyAdd(one, h)
    pyAdd(plain, h)
    if (plain.indexOf('v') >= 0) { pyAdd(plain.replace(/v/g, 'u'), h); pyAdd(plain.replace(/v/g, 'ü'), h) }
  }
}

/* ---------- 输出 ----------
 * 注意：不要改成「大字符串 + JSON.parse」——实测那样转义开销会把字节码撑大约 30%
 * （lookup.jsc 612KB → 794KB）。保持对象字面量，靠"数据只进 app.ux 一处"控制体积。
 */
const n = Object.keys(LEX).length
const META = {
  count: n,
  alias: Object.keys(ALIAS).length,
  pinyinKeys: Object.keys(PY).length,
  sources: [
    '词条正文：本项目人工撰写（词性 · 今译 · 例句），例句取自公版古籍',
    '拼音/部首/笔画：Unihan（unicode.org，Unicode License）'
  ],
  fields: 'LEX[字头] = [拼音, 部首, 笔画, 用法串]；用法串格式「词性|今译|例句|出处」用 ; 分隔'
}
const src = '/* 由 tools/build-words.mjs 生成，请改 src/common/data/words*.js */\n' +
  'export const LEX = ' + JSON.stringify(LEX) + '\n' +
  'export const ALIAS = ' + JSON.stringify(ALIAS) + '\n' +
  'export const PY = ' + JSON.stringify(PY) + '\n' +
  'export const META = ' + JSON.stringify(META) + '\n'
fs.writeFileSync(OUT, src)

console.log('词条：' + n + ' 字　别名：' + Object.keys(ALIAS).length + ' 个　拼音键：' + Object.keys(PY).length + ' 个')
console.log('输出：' + OUT + '（' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB）')
if (dupes.length) console.log('⚠ 重复字头（已忽略后面的）：' + dupes.slice(0, 12).join(' '))
if (noPinyin.length) console.log('⚠ 缺拼音的字：' + noPinyin.slice(0, 20).join(''))
for (const h of ['以', '水', '给', '说']) {
  if (!LEX[h]) { console.log('示例 ' + h + '：没有词条'); continue }
  const e = LEX[h]
  console.log('  ' + h + '　' + e[0] + '　' + e[1] + '部' + e[2] + '画　义项 ' + e[3].split(';').length + ' 条')
}
