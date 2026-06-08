#!/bin/bash
set -euo pipefail

SOURCE_DIR="$HOME/.config/root"

if [ ! -d "$SOURCE_DIR" ]; then
    exit 0
fi

cd "$SOURCE_DIR"

# 将 ~/.config/root 中的文件以软链接映射到系统根目录；同名目标路径会被覆盖。
find . -type f -print0 | while IFS= read -r -d '' file_rel_path; do
    clean_path="${file_rel_path#./}"
    target_path="/$clean_path"
    target_dir=$(dirname "$target_path")

    if [ ! -d "$target_dir" ]; then
        sudo mkdir -p "$target_dir"
    fi

    sudo ln -sf "$SOURCE_DIR/$clean_path" "$target_path"
done
