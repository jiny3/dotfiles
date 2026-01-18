#!/bin/bash

# 获取 darkMode 状态
IS_DARK=$(qs -c noctalia-shell ipc call state all | grep -oP '"darkMode":\s*\K[^,}]*')

if [ "$IS_DARK" = "true" ]; then
  BACKGROUND="$HOME/.background-dark"
  PREFER="prefer-dark"
else
  BACKGROUND="$HOME/.background"
  PREFER="prefer-light"
fi

run_with_retry() {
  local cmd=$1
  for _ in {1..5}; do
    # 尝试执行，并隐藏不必要的错误输出
    if eval "$cmd" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "错误: 执行 '$cmd' 失败" >&2
  return 1
}

run_with_retry "qs -c noctalia-shell ipc call wallpaper set $BACKGROUND all"
gsettings set org.gnome.desktop.interface color-scheme $PREFER
