# -*- coding: utf-8 -*-
"""把工具箱里验证过的键盘接线移植到词典工程。

与工具箱的差别：词典要中文拼音流程（打拼音 → 点候选字 → 查词），所以
组件里的词库、候选横滚行、语言键、进度环全部保留；几何是 192 基准（本工程 designWidth=192），
也一律不动。只移植"能呼出 + 键不被压扁"这套机制：
  1. 按需挂载 if + hide={{false}}（作者自己标注 hide watcher 在部分设备不可靠）
  2. .calbtn66 / 三排容器 / 空格键 加 flex-shrink:0（否则 10 个 60px 键被压成 ~21px，只看得见行尾）
  3. 内容层显式 width:630px（10 键宽，横滚才有可滚的余量）
  4. onInit 包 try/catch（词库加载器/取屏宽抛错会让整个组件初始化中断且不报错）
  5. 组件根节点 padding:0px（宿主 base.css 的 .page 有 14px 左右内边距，会串味到键盘）
"""
import io, sys

UX = r'C:\Users\39830\Documents\zcode\gushici-dict\src\components\InputMethod\InputMethod.ux'
PAGE = r'C:\Users\39830\Documents\zcode\gushici-dict\src\pages\lookup\lookup.ux'

def load(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def save(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def sub(s, old, new, n, tag):
    c = s.count(old)
    if c != n:
        print('!! [%s] 期望 %d 处，实际 %d 处：%r' % (tag, n, c, old[:80]))
        sys.exit(1)
    print('ok [%s] x%d' % (tag, n))
    return s.replace(old, new)

s = load(UX)

# 1) 键不许被压缩（锚点带上 .calbtn66 类名，因为另有同体样式的类）
s = sub(s, '''.calbtn66 {
\tcolor:rgb(255,255,255);
\tfont-size:32px;
\tfont-weight:bold;
\tbackground-color:rgb(38,38,38);
\tmargin-right:3px;
\twidth:60px;
\theight:60px;''',
        '''.calbtn66 {
\tcolor:rgb(255,255,255);
\tfont-size:32px;
\tfont-weight:bold;
\tbackground-color:rgb(38,38,38);
\tmargin-right:3px;
\twidth:60px;
\theight:60px;
\tflex-shrink:0;''', 1, 'calbtn66 加 flex-shrink:0')

# 2) 三排键的容器行
for pat, tag in [('margin-left: 0px;margin-top: 0px;height: 60px;', '第 1 排容器'),
                 ('margin-left: 32px;margin-top: -5px;height: 60px;', '第 2 排容器'),
                 ('margin-left: 64px;margin-top: -5px;height: 60px;', '第 3 排容器')]:
    s = sub(s, '<div static style="%s">' % pat,
            '<div static style="%s%s">' % (pat, 'flex-shrink: 0;'),
            6, tag)

# 3) 空格键（跟在第三排后面）
s = sub(s, '<img static src="./assets/arc/space.png" style="width: 60px;height: 60px;" @click="onBtnClick(\'space\')" />',
        '<img static src="./assets/arc/space.png" style="width: 60px;height: 60px;flex-shrink: 0;" @click="onBtnClick(\'space\')" />',
        1, '空格键锁定')

# 4) 内容层显式宽度（pill 分支的三个：left: 3px）
for cond, tag in [('{{!numFlag}}', '字母页内容层'),
                  ('{{numFlag && !numFlag_jp}}', '数字页内容层'),
                  ('{{numFlag_jp}}', '日文数字页内容层')]:
    s = sub(s, '<div if="%s" style="left: 3px; flex-direction: column;">' % cond,
            '<div if="%s" style="left: 3px; width: 630px; flex-direction: column;">' % cond,
            1, tag)

# 5) onInit 包 try/catch + 根节点 padding 归零
s = sub(s, '''    Object.defineProperty(this, "_dictionary", {
      value: createDictionaryLoader(this.dictionarypath), configurable: true
    });''',
        '''    try {
      Object.defineProperty(this, "_dictionary", {
        value: createDictionaryLoader(this.dictionarypath), configurable: true
      });
    } catch (e) {
      Object.defineProperty(this, "_dictionary", {
        value: { load: function () {}, release: function () {}, destroy: function () {} },
        configurable: true
      });
    }''', 1, 'onInit 词库加载器护住')
s = sub(s, '''    if (this.screentype === "rect" || this.screentype === "pill-shaped") {
      this.adjustScreenWidth();
    }''',
        '''    try {
      if (this.screentype === "rect" || this.screentype === "pill-shaped") {
        this.adjustScreenWidth();
      }
    } catch (e) {
      this.screenWidth = 212;
    }''', 1, 'onInit 取屏宽护住')
s = sub(s, '''  onDestroy() {
    this._dictionary.destroy();
  },''',
        '''  onDestroy() {
    try {
      this._dictionary.destroy();
    } catch (e) {}
  },''', 1, 'onDestroy 护住')
s = sub(s, '<div class="page" style="flex-direction: column; height: {{hide ? \'0px\' : \'auto\'}}; overflow: {{hide ? \'hidden\' : \'visible\'}};">',
        '<div class="page" style="flex-direction: column; padding: 0px; height: {{hide ? \'0px\' : \'auto\'}}; overflow: {{hide ? \'hidden\' : \'visible\'}};">',
        1, '根节点 padding 归零')
save(UX, s)

# ---- 页面：按需挂载 ----
t = load(PAGE)
t = sub(t, '''    <!-- 输入法组件：容器整宽（组件内部是绝对定位，容器给左右内边距会让它偏左） -->
    <input-method
      hide="{{kbHide}}"''',
        '''    <!-- 输入法组件：按需挂载而不是切 hide —— 组件作者在源码里标注 hide watcher 在部分设备不可靠，
         所以只在需要时把组件建出来，并直接传 hide={{false}} 让它一建出来就是展开的。
         注意 hide 必须写 {{false}}，字符串 "false" 是 truthy，会被当成隐藏。
         本页是拼音查词，组件里中文词库/候选行/语言键都保留。 -->
    <input-method if="{{kbOn}}"
      hide="{{false}}"''', 1, '按需挂载')
t = sub(t, '    kbHide: true,', '    kbOn: false,', 1, '状态改名')
t = sub(t, "{{kbHide ? '' : 'on'}}", "{{kbOn ? 'on' : ''}}", 1, '搜索框高亮')
t = sub(t, "{{kbHide ? '点击输入' : '点击收起'}}", "{{kbOn ? '点击收起' : '点击输入'}}", 1, '搜索框提示')
t = sub(t, '''    this.kbHide = !this.kbHide
    if (!this.kbHide) this.hint = '打拼音（wo / qizi），点候选字看解释\'''',
        '''    this.kbOn = !this.kbOn
    if (this.kbOn) this.hint = '打拼音（wo / qizi），点候选字看解释\'''', 1, 'toggleKb')
save(PAGE, t)
print('done')
