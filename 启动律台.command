#!/bin/zsh -l
# 双击即可启动：在终端里运行本地服务并自动打开浏览器
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js，请先安装：https://nodejs.org 或 brew install node"
  read -k 1 "?按任意键退出"
  exit 1
fi
node server.js
