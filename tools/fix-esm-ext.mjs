/**
 * 给指定目录下的 .js 补全相对导入的扩展名。
 *
 * 为什么需要：Vela 的打包器按无扩展名解析（`import { x } from './usage'`），
 * 而 Node ESM 必须带 `.js`。测试是在 Node 上跑内核代码的，所以在拷贝阶段补一下，
 * 工程源码本身仍按 Vela 的写法（不加扩展名）。
 *
 * 用法：node tools/fix-esm-ext.mjs <目录>
 */
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
if (!dir || !fs.existsSync(dir)) {
  console.log('用法：node tools/fix-esm-ext.mjs <目录>')
  process.exit(1)
}

let files = 0
let fixed = 0
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('.js')) continue
  const p = path.join(dir, name)
  const src = fs.readFileSync(p, 'utf8')
  const out = src.replace(/(from\s+['"])(\.[^'"]*)(['"])/g, (all, a, spec, c) => {
    if (spec.endsWith('.js') || spec.endsWith('.json')) return all
    return a + spec + '.js' + c
  })
  files++
  if (out !== src) { fs.writeFileSync(p, out); fixed++ }
}
console.log('  补扩展名：扫 ' + files + ' 个文件，改动 ' + fixed + ' 个')
