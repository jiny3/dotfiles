#!/bin/bash

# 获取 darkMode 状态
IS_DARK=$(qs -c noctalia-shell ipc call state all | grep -oP '"darkMode":\s*\K[^,}]*')

if [ "$IS_DARK" = "false" ]; then
  exit 1
fi
