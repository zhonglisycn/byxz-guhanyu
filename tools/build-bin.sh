#!/usr/bin/env bash
# 一键构建：数据校验 → 内核测试 → 页面静态检查 → 编译 → 输出 .bin
set -e
cd "$(dirname "$0")/.."

NAME="古汉语词典_byxz"

echo "=== 1/4 内核测试（表达式 / 方程 / 绘图）==="
bash tools/run-tests.sh

echo ""
echo "=== 2/4 页面静态检查 ==="
node tools/check-ux.mjs
node tools/fix-text-style.mjs

echo ""
echo "=== 3/4 编译（--enable-jsc 生成字节码）==="
OUT=$(npx aiot build --enable-jsc 2>&1) || true
echo "$OUT" | tail -20
# 编译失败时工具链可能仍以 0 退出（实测过），必须自己校验，否则会拷一个旧包当成新包
if ! echo "$OUT" | grep -q "build success"; then
  echo "❌ 编译没有成功（上面是工具链输出），已中止，不输出 .bin"
  exit 1
fi

echo ""
echo "=== 4/4 输出 .bin ==="
RPK=$(ls dist/*.rpk | head -1)
cp "$RPK" "dist/$NAME.bin"
ls -la "dist/$NAME.bin"
echo ""
echo "完成：dist/$NAME.bin"
