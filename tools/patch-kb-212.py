# -*- coding: utf-8 -*-
"""词典工程：把组件的 pill 分支几何从 192 基准改成 212 基准（只改坐标，不动中文流程）。

问题：本工程 designWidth=192，而这个组件的 pill 版是按 192 屏宽摆的——盒子 width:192 +
按 (screenWidth-192)/2 居中；手环 10 是 212 宽，于是右边空 20px，观感就是"键盘整体偏左"。
工具箱当初就是这个毛病，改法一致：盒子/横滚留白基准换 212，内层 x 按锚点重算——
  左贴边 +0（back2 保持 9）
  居中   +10（123 键 70→80、大小写 72→82、展开键 120→140……按各自锚点算）
  右贴边 +20（del 135→155、down2 120→140）
  输入条 186→206（3+206+3=212）
  进度环 left 2→12
外加 data.screenWidth 默认 336→212，并在 adjustScreenWidth 里下限锁 212
（取小了会把 left 算成负数顶到左边，正是"偏左"的成因之一）。

中文相关一律不动：lang 默认 cn、词库、候选横滚行、语言键、候选下展面板、onKbComplete→run(t)。
"""
import io, sys

UX = r'C:\Users\39830\Documents\zcode\gushici-dict\src\components\InputMethod\InputMethod.ux'

with io.open(UX, 'r', encoding='utf-8') as f:
    s = f.read()

def sub(s, old, new, n, tag):
    c = s.count(old)
    if c != n:
        print('!! [%s] 期望 %d 处，实际 %d 处：%r' % (tag, n, c, old[:80]))
        sys.exit(1)
    print('ok [%s] x%d' % (tag, n))
    return s.replace(old, new)

# 1) 居中基准 192 -> 212（环的 margin、滚动留白 2 处、顶栏盒 left、下展盒 left）
s = sub(s, '(screenWidth - 192)/2', '(screenWidth - 212)/2', 5, '居中基准 192->212')
# 2) 进度环 left 2 -> 12（212 下左右各留 12）
s = sub(s, 'top:82px;left:2px;position:absolute;', 'top:82px;left:12px;position:absolute;', 1, '进度环 left 2->12')
# 3) 顶栏盒子 / 下展盒子 宽 192 -> 212
s = sub(s, 'top: 0px;width: 192px;height: 110px;', 'top: 0px;width: 212px;height: 110px;', 1, '顶栏盒子 192->212')
s = sub(s, 'width: 192px;height: 263px;', 'width: 212px;height: 263px;', 1, '下展盒子 192->212')
# 4) 输入条 186 -> 206
s = sub(s, 'top: 47px;width: 186px;height: 60px;" src="./assets/arc/search.png"',
        'top: 47px;width: 206px;height: 60px;" src="./assets/arc/search.png"', 1, '输入条 186->206')
# 5) 居中键 +10、右贴边键 +20
s = sub(s, 'left: 70px;top: 0px;width: 52px;height: 42px;', 'left: 80px;top: 0px;width: 52px;height: 42px;', 2, '123 键 70->80')
s = sub(s, 'top:0px;left:72px;width:48px;height:42px;', 'top:0px;left:82px;width:48px;height:42px;', 2, '大小写键 72->82')
s = sub(s, 'left: 120px;top: 57px;width: 60px;height: 40px;" src="./assets/arc/down2.png"',
        'left: 140px;top: 57px;width: 60px;height: 40px;" src="./assets/arc/down2.png"', 1, 'down2 120->140')
s = sub(s, 'left: 135px;top: 0px;width: 48px;height: 42px;', 'left: 155px;top: 0px;width: 48px;height: 42px;', 1, 'del 135->155')
s = sub(s, 'top:196px;left:56px;width: 80px;height: 60px;" src="./assets/arc/up2.png"',
        'top:196px;left:66px;width: 80px;height: 60px;" src="./assets/arc/up2.png"', 1, '下展收起键 56->66')
# 6) 屏宽默认值 + 下限保护
s = sub(s, '    screenWidth: 336,', '    screenWidth: 212,', 1, '默认屏宽 212')
s = sub(s, '''  adjustScreenWidth(){
    device.getInfo({
      success: (data) => {
        this.screenWidth = data.screenWidth;
      }
    })
  }''',
        '''  adjustScreenWidth(){
    device.getInfo({
      success: (data) => {
        // pill 版是 212 宽的定宽盒子，屏宽取小了会把 left 算成负数顶到左边（"键盘偏左"的成因之一），
        // 所以下限锁 212：小屏最多溢出，不会错位。
        var w = Number(data && data.screenWidth) || 212;
        this.screenWidth = w < 212 ? 212 : w;
      }
    })
  }''', 1, 'adjustScreenWidth 下限锁 212')

with io.open(UX, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
print('done')
