#!/bin/bash

MODE=$1

case "$MODE" in
dark)
  VICINAE_THEME="rose-pine-moon"
  NOCTALIA_MODE="setDark"
  ;;
light)
  VICINAE_THEME="rose-pine-dawn"
  NOCTALIA_MODE="setLight"
  ;;
*)
  exit 0
  ;;
esac

run_with_retry() {
  local cmd=$1
  for _ in {1..5}; do # 最多重试5次
    if eval "$cmd"; then
      return 0
    fi
    sleep 0.5 # 每次等待0.5秒
  done
}

# 1. 执行 Vicinae 主题切换
run_with_retry "vicinae theme set $VICINAE_THEME" &

# 2. 执行 Noctalia 主题切换 (使用我们查到的 darkMode target)
run_with_retry "quickshell -c noctalia-shell ipc call darkMode $NOCTALIA_MODE" &
