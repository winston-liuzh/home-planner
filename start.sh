#!/bin/bash
echo "================================"
echo "  Home Planner 启动中..."
echo "================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装: https://nodejs.org/"
    echo "下载 LTS 版本，安装后重新运行此脚本。"
    exit 1
fi

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败，请检查网络连接。"
        exit 1
    fi
    echo ""
fi

# 检查是否已构建
if [ ! -f "dist/index.html" ]; then
    echo "正在构建项目..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "[错误] 构建失败。"
        exit 1
    fi
    echo ""
fi

echo "启动本地服务器..."
echo "启动后浏览器访问 http://localhost:3000"
echo "按 Ctrl+C 可停止服务器。"
echo ""
npx serve dist -l 3000
