#!/bin/bash

# 获取 darkMode 状态
IS_DARK=$(qs -c noctalia-shell ipc call state all | grep -oP '"darkMode":\s*\K[^,}]*')

if [ "$IS_DARK" = "true" ]; then
    BACKGROUND="$HOME/.background-dark"
    CURSOR="Bibata-Modern-Classic"
else
    BACKGROUND="$HOME/.background"
    CURSOR="Bibata-Modern-Ice"
fi

qs -c noctalia-shell ipc call wallpaper set $BACKGROUND all
# change cursor
sed -i "s/xcursor-theme \"[^\"]*\"/xcursor-theme \"$CURSOR\"/" "$HOME/.config/niri/configs/misc.kdl"
