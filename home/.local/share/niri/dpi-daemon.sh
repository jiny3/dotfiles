#!/bin/bash

update_xft_dpi() {
    local screen_id
    screen_id=$(niri msg -j workspaces | jq -r '.[] | select(.is_focused == true) | .output' | head -n 1)

    local dpi
    case "$screen_id" in
    "eDP-1")
        dpi=192
        ;;
    "DP-1")
        dpi=96
        ;;
    *)
        dpi=96
        ;;
    esac

    echo "Xft.dpi: $dpi" | xrdb -merge
}

update_xft_dpi

niri msg -j event-stream | jq --unbuffered -r 'keys[]' | while read -r event; do
    case "$event" in
    "WorkspaceActivated" | "WorkspacesChanged" | "OutputsChanged")
        update_xft_dpi
        ;;
    esac
done
