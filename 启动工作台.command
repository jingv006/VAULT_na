#!/bin/zsh
cd "$(dirname "$0")"
/usr/bin/python3 server.py --port 8765 --open
