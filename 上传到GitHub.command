#!/bin/zsh
cd "$(dirname "$0")"
/usr/bin/python3 tools/publish_github.py
result=$?
echo "按回车关闭窗口…"
read -r
exit "$result"
