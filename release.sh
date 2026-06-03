#!/bin/bash
set -e

echo "================================"
echo "  Home Planner 一键发版"
echo "================================"
echo ""

# 检查 git
if ! command -v git &> /dev/null; then
    echo "[错误] 未检测到 git，请先安装。"
    exit 1
fi

# 检查是否有未提交的更改
if ! git diff --quiet 2>/dev/null; then
    echo "[警告] 有未提交的更改，建议先提交。"
    read -p "是否继续？(y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then exit 0; fi
fi

# 读取当前版本
CURRENT=$(node -p "require('./package.json').version")
echo "当前版本: $CURRENT"
echo ""

read -p "请输入新版本号 (如 0.5.0): " VERSION
if [ -z "$VERSION" ]; then
    echo "[错误] 版本号不能为空。"
    exit 1
fi

echo ""
echo "即将发布版本: $VERSION"
echo "操作将:"
echo "  1. 更新 package.json 版本号"
echo "  2. 提交更改"
echo "  3. 创建 tag v$VERSION"
echo "  4. 推送到 GitHub"
echo "  5. GitHub Actions 自动打包 Win/Mac/Linux"
echo ""
read -p "确认发布？(y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then exit 0; fi

# 更新版本号
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$VERSION';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"

# 提交
git add package.json
git commit -m "release v$VERSION"

# 打 tag
git tag "v$VERSION"

# 推送
git push origin main
git push origin "v$VERSION"

echo ""
echo "================================"
echo "  发布成功！"
echo "================================"
echo ""
echo "GitHub Actions 正在自动打包:"
echo "  - Windows (.exe)"
echo "  - macOS (.dmg)"
echo "  - Linux (.AppImage)"
echo ""
echo "请到 GitHub 仓库的 Actions 页面查看进度。"
echo "打包完成后在 Artifacts 中下载。"
