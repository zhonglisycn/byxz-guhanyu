/**
 * 生成输入法组件用的词库（用本词典自己的数据）
 *
 * 为什么不让输入法用自己的词库：它那份 cn.txt 有 28KB、27 个词组分片按需读，
 * 每打一个字母还要重算候选并重画候选行。手环上这就是"快速运算渲染"，
 * 实测反馈是打字能把设备拖到重启。
 *
 * 换成自己的词库有三个好处：
 *   ① 候选就是本词典收的字（打不出来、查不到的情况消失）；
 *   ② 候选顺序就是词典的常用度顺序（写在前面的最常用）；
 *   ③ 数据小：cn.txt ≈ 10KB，词组分片直接清空（整词查询由词典自己负责，
 *      见 app.ux 的 search 支持整词拼音如 qizi）。
 *
 * 用法：node tools/build-ime-dict.mjs
 */
import fs from 'node:fs'
import { LEX } from '../src/common/data/lexicon.js'

const DIR = 'src/components/InputMethod/assets/dictionary'
if (!fs.existsSync(DIR)) {
  console.log('没找到输入法词库目录：' + DIR + '（组件未安装？）')
  process.exit(1)
}

const TONE = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a', a: 'a', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', o: 'o',
  ē: 'e', é: 'e', ě: 'e', è: 'e', e: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i', i: 'i',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', u: 'u', ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
  ń: 'n', ň: 'n', ǹ: 'n', ḿ: 'm'
}
const plain = (s) => {
  let out = ''
  for (const c of String(s).toLowerCase()) out += (TONE[c] !== undefined ? TONE[c] : c)
  return out
}

// 单字：按词库顺序（常用度）挂到它的拼音下
const chars = {}
const syllables = new Set()
for (const h in LEX) {
  if (Array.from(h).length !== 1) continue
  const py = plain((LEX[h][0] || '').split(' ')[0]).replace(/[^a-z]/g, '')
  if (!py) continue
  if (!chars[py]) chars[py] = ''
  chars[py] += h
  syllables.add(py)
}
// 复词首字也算进音节表，逐字打的时候有候选
const sorted = Array.from(syllables).sort()
const cn = { chars: chars, syllables: sorted }
fs.writeFileSync(DIR + '/cn.txt', JSON.stringify(cn))

// 词组分片清空：整词查询交给词典自己（少 27 次文件读取与分片安装）
let stubbed = 0
for (const f of fs.readdirSync(DIR)) {
  if (!/^words-.*\.txt$/.test(f)) continue
  fs.writeFileSync(DIR + '/' + f, JSON.stringify({ words: {}, initials: {}, forward: {} }))
  stubbed++
}

const total = Object.values(chars).reduce((a, s) => a + Array.from(s).length, 0)
console.log('输入法词库已换成词典自己的数据')
console.log('  音节 ' + sorted.length + ' 个，可输入汉字 ' + total + ' 个')
console.log('  cn.txt ' + (fs.statSync(DIR + '/cn.txt').size / 1024).toFixed(1) + ' KB（原来是 28.0 KB）')
console.log('  清空词组分片 ' + stubbed + ' 个（不装分片、不算词组候选）')
console.log('  抽查：wo → ' + (chars['wo'] || '').slice(0, 10) + '　qizi 走词典自己的整词查：' + (LEX['妻子'] ? '妻子 ✓' : '✗'))
