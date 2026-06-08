#!/bin/bash

update_xft_dpi() {
    local screen_id scale dpi
    screen_id=$(niri msg --json workspaces | jq -r '.[] | select(.is_focused == true) | .output' | head -n 1)

    if [[ -z "$screen_id" || "$screen_id" == "null" ]]; then
        dpi=96
    else
        scale=$(niri msg --json outputs | jq -r --arg output "$screen_id" '
            if type == "object" then (.[$output].scale // 1)
            elif type == "array" then ([.[] | select(.name == $output).scale][0] // 1)
            else 1 end
        ' 2>/dev/null)

        if [[ -z "$scale" || "$scale" == "null" ]]; then
            scale=1
        fi

        dpi=$(awk -v scale="$scale" 'BEGIN { printf "%d", (scale * 96) + 0.5 }')
    fi

    echo "Xft.dpi: $dpi" | xrdb -merge
}

update_xft_dpi

niri msg --json event-stream | jq --unbuffered -r 'keys[]' | while read -r event; do
    case "$event" in
    "WorkspaceActivated" | "WorkspacesChanged" | "OutputsChanged")
        update_xft_dpi
        ;;
    esac
done
