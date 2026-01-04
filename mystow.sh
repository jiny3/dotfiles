#!/bin/bash

PACKAGE=$1
TARGET_DIR=$2
ACTION=$3

# 1. 参数校验
if [ "$#" -ne 3 ]; then
  echo "用法: $0 <PACKAGE> <TARGET_DIR> <apply|revert|update>"
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

  # 提取冲突文件名的逻辑
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

  stow -v -t "$TARGET_DIR" "$PACKAGE"
}

revert_logic() {
  echo ">>> 正在撤销并还原备份: $PACKAGE"

  # 撤销软链接
  stow -D -v -t "$TARGET_DIR" "$PACKAGE"

  # 还原备份文件
  # 使用 find 遍历 PACKAGE 结构以支持深层子目录的备份还原
  find "$PACKAGE" -maxdepth 1 -not -path "$PACKAGE" | while read -r path; do
    item=$(basename "$path")
    bak_file="$TARGET_DIR/$item.stow.bak"
    target_file="$TARGET_DIR/$item"
    if [ -e "$bak_file" ] && [ ! -e "$target_file" ]; then
      echo "  [还原] $bak_file -> $target_file"
      mv "$bak_file" "$target_file"
    fi
  done
}

# 3. 操作分发
case "$ACTION" in
"apply")
  apply_logic
  ;;
"revert")
  revert_logic
  ;;
"update")
  echo ">>> 正在执行更新程序..."
  revert_logic
  apply_logic
  echo ">>> 更新完成！"
  ;;
*)
  echo "错误: 无效操作 '$ACTION'，仅支持 apply, revert, update"
  exit 1
  ;;
esac
