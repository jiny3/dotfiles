#!/bin/bash

PACKAGE=$1
TARGET_DIR=$2
ACTION=$3

# 1. 参数校验
if [ "$#" -ne 3 ]; then
  echo "用法: $0 <PACKAGE> <TARGET_DIR> <apply|revert>"
  exit 1
fi

if [ ! -d "$PACKAGE" ]; then
  echo "错误: Package '$PACKAGE' 不存在"
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "错误: Target '$TARGET_DIR' 不存在"
  exit 1
fi

# 2. 逻辑函数
apply_logic() {
  echo ">>> 正在检查冲突并应用: $PACKAGE -> $TARGET_DIR"

  # 提取冲突文件名的逻辑：
  # 匹配 "existing target " 和 " since" 之间的内容
  conflicts=$(stow -n -v -t "$TARGET_DIR" "$PACKAGE" 2>&1 |
    grep "since neither a link nor a directory" |
    sed -n 's/.*existing target \(.*\) since.*/\1/p' |
    tr -d "'\"")

  if [ -n "$conflicts" ]; then
    for file in $conflicts; do
      full_path="$TARGET_DIR/$file"
      if [ -e "$full_path" ] && [ ! -L "$full_path" ]; then
        echo "  [备份] $full_path -> $full_path.stow.bak"
        mv "$full_path" "$full_path.stow.bak"
      fi
    done
  fi

  # 执行真正的 stow
  stow -v -t "$TARGET_DIR" "$PACKAGE"
}

revert_logic() {
  echo ">>> 正在撤销并还原备份: $PACKAGE"

  stow -D -v -t "$TARGET_DIR" "$PACKAGE"

  # 精准还原：根据 PACKAGE 里的内容去 TARGET_DIR 找对应的 .stow.bak
  ls -A "$PACKAGE" | while read -r item; do
    bak_file="$TARGET_DIR/$item.stow.bak"
    target_file="$TARGET_DIR/$item"
    if [ -f "$bak_file" ] && [ ! -e "$target_file" ]; then
      echo "  [还原] $bak_file -> $target_file"
      mv "$bak_file" "$target_file"
    fi
  done
}

case "$ACTION" in
"apply") apply_logic ;;
"revert") revert_logic ;;
*)
  echo "错误操作"
  exit 1
  ;;
esac
