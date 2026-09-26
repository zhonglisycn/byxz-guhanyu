/**
 * 词库测试（不需要真机）
 *
 * 覆盖：词条结构、用法串解析、拼音/别名查询、页面分段，以及全量数据的书写规范
 * （词性代码写错、今译为空、多写的竖线、别名指向不存在的字头……这些都只能靠这里兜住）。
 * 跑法：bash tools/run-tests.sh
 */
import { LEX, ALIAS, PY, META } from './data/lexicon.js'
import {
  ready, total, stats, aliasOf, entryOf, sections, senseCount, brief,
  pinyinSearch, sourceText, pushRecent, toggleFav, isFav
} from './core/dict.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')) }
}
const head = (t) => console.log('\n### ' + t)

const POS_OK = ['名', '动', '形', '副', '介', '连', '助', '代', '量', '数', '叹', '兼', '通']
const heads = Object.keys(LEX)

head('词库规模')
ok('词库就绪', ready())
ok('收字 ' + total() + ' 个', total() > 400, String(total()))
ok('收字数与元数据一致', total() === heads.length, total() + ' vs ' + heads.length)
ok('别名 ' + stats().alias + ' 个', stats().alias > 100)
ok('拼音键 ' + stats().pinyinKeys + ' 个', stats().pinyinKeys > 300)
ok('来源有署名', sourceText().indexOf('Unihan') >= 0 && sourceText().indexOf('人工撰写') >= 0)

head('查字（以 · 虚词的标准形态）')
const yi = entryOf('以')
ok('查到「以」', !!yi)
ok('拼音 yǐ', yi && yi.y === 'yǐ', yi && yi.y)
ok('部首/笔画', !!(yi && yi.r && yi.b), yi ? yi.r + yi.b : '')
ok('义项 ≥10 条', !!yi && senseCount(yi) >= 10, yi ? String(senseCount(yi)) : '')
const secYi = sections(yi)
ok('分段第一块是用法标题', secYi[0].t === 'hd' && secYi[0].g.indexOf('用法') >= 0)
const posYi = secYi.filter((x) => x.t === 'pos').map((x) => x.g)
ok('按词性分条：' + posYi.join(' / '),
  posYi.some((g) => g.indexOf('作介词') >= 0) && posYi.some((g) => g.indexOf('作连词') >= 0) && posYi.some((g) => g.indexOf('作助词') >= 0))
ok('用法条带序号', secYi.filter((x) => x.t === 'it').every((x) => /^[①-⑮(]/.test(x.g)))
ok('例句都成"例：“…”（《…》）"格式', secYi.filter((x) => x.c).every((x) => x.c.indexOf('例：“') === 0))
ok('摘要取首条今译', brief(yi).length > 3, brief(yi))

head('古今异义复词（古诗文阅读的重点）')
const wordsAll = heads.filter((h) => Array.from(h).length > 1)
ok('复词 ' + wordsAll.length + ' 条', wordsAll.length >= 80)
const qi = entryOf('妻子')
ok('查到「妻子」', !!qi)
ok('复词拼音按字拼起来', !!qi && qi.y === 'qī zǐ', qi && qi.y)
ok('古今对照写在今译里', !!qi && brief(qi).indexOf('古义') >= 0 && brief(qi).indexOf('今义') >= 0, brief(qi))
ok('复词有例句出处', !!qi && sections(qi).some((b) => b.c && b.c.indexOf('桃花源记') >= 0))
ok('整词拼音能查（qizi）', (pinyinSearch('qizi') || []).indexOf('妻子') >= 0)
ok('「可怜」古今异义', (brief(entryOf('可怜')) || '').indexOf('古义') >= 0, brief(entryOf('可怜')))

head('拼音查字')
const woList = pinyinSearch('wo')
ok('wo 有候选（' + (woList ? woList.length : 0) + ' 个）', !!woList && woList.length >= 1)
ok('wo 里有「我」', !!woList && woList.indexOf('我') >= 0)
ok('带调 wǒ 也能查', (pinyinSearch('wǒ') || []).indexOf('我') >= 0)
ok('zhong 能查到「中」', (pinyinSearch('zhong') || []).indexOf('中') >= 0)
ok('nv 能查到「女」（ü 写 v）', (pinyinSearch('nv') || []).indexOf('女') >= 0)
ok('不存在的音返回空', !pinyinSearch('zzzz'))

head('繁体 / 异体写法')
ok('「給」→ 给', !!aliasOf('給') && aliasOf('給')[0] === '给', JSON.stringify(aliasOf('給')))
ok('按繁体写法能查到词条', !!entryOf('給') && entryOf('給').h === '给')
ok('「說」→ 说', !!entryOf('說') && entryOf('說').h === '说')
const SIMP = ['说', '给', '国', '为', '见', '会', '发', '无', '来']
const notSimp = SIMP.filter((c) => LEX[c] === undefined)
ok('字头用简体（繁体只作别名）', notSimp.length === 0, '缺：' + notSimp.join(''))

head('收藏 / 历史')
ok('收藏加入', toggleFav([], '以').added === true)
ok('收藏去重', toggleFav(['以'], '以').added === false)
ok('已收藏判断', isFav(['以'], '以') === true)
ok('历史最新在前、去重', pushRecent(['水', '火'], '以').join('') === '以水火')
ok('历史有上限', pushRecent(Array.from({ length: 80 }, (_, i) => 'x' + i), '新', 60).length === 60)

head('全量词条体检')
let badPos = []
let badGloss = []
let pipeLeft = []
let emptyGroup = []
let srcNoEx = []
let noPy = []
let longGloss = []
for (const h of heads) {
  const raw = LEX[h]
  if (!raw[0]) noPy.push(h)
  const parts = String(raw[3] || '').split(';')
  if (!parts.length) emptyGroup.push(h)
  for (const part of parts) {
    const t = part.trim()
    if (!t) continue
    const f = t.split('|')
    if (POS_OK.indexOf(f[0]) < 0) badPos.push(h + ':' + f[0])
    if (!f[1] || !f[1].trim()) badGloss.push(h)
    if (f[1] && f[1].length > 90) longGloss.push(h)
    if (f[1] && f[1].indexOf('｜') >= 0) pipeLeft.push(h)
    if (f[2] && !f[3]) srcNoEx.push(h)
  }
}
ok('词性代码都在允许表内', badPos.length === 0, badPos.slice(0, 8).join(' '))
ok('没有空的今译', badGloss.length === 0, badGloss.slice(0, 8).join(''))
ok('今译里没有残留的分隔符', pipeLeft.length === 0, pipeLeft.slice(0, 8).join(''))
ok('单条今译不过长（≤90 字）', longGloss.length === 0, longGloss.slice(0, 8).join(''))
ok('有例句的都有出处（' + srcNoEx.length + ' 处只有例句没出处）', srcNoEx.length < 20, srcNoEx.slice(0, 8).join(''))
ok('每个字都有拼音（缺 ' + noPy.length + ' 个）', noPy.length === 0, noPy.slice(0, 12).join(''))
const badAlias = Object.keys(ALIAS).filter((a) => LEX[ALIAS[a]] === undefined)
ok('别名都指向存在的字头', badAlias.length === 0, badAlias.slice(0, 8).join(''))
const badPy = []
for (const k in PY) for (const h of PY[k]) if (LEX[h] === undefined) badPy.push(k + '→' + h)
ok('拼音索引里的字都在词库中', badPy.length === 0, badPy.slice(0, 8).join(''))

console.log('\n----------------------------------------')
console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '失败 ' + fail + ' 项 / 通过 ' + pass + ' 项')
process.exit(fail === 0 ? 0 : 1)
