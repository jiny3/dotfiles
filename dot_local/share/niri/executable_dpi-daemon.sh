#!/bin/bash

update_xft_dpi() {
    local output scale dpi

    output=$(
        niri msg -j workspaces |
            jq -r '.[] | select(.is_focused) | .output' |
            head -n1
    )

    [[ -z "$output" ]] && return

    scale=$(
        niri msg -j outputs |
            jq -r --arg output "$output" '
            .[$output].logical.scale // 1
        '
    )

    dpi=$(
        awk -v scale="$scale" \
            'BEGIN { printf "%d", scale * 96 + 0.5 }'
    )

    if [[ "$dpi" != "$last_dpi" ]]; then
        echo "Setting Xft.dpi=$dpi (scale=$scale, output=$output)"
        echo "Xft.dpi: $dpi" | xrdb -merge
        last_dpi="$dpi"
    fi
}

update_xft_dpi

niri msg --json event-stream | jq --unbuffered -r 'keys[]' | while read -r event; do
    case "$event" in
    "WorkspaceActivated" | "WorkspacesChanged" | "OutputsChanged")
        update_xft_dpi
        ;;
    esac
done

update_xft_dpi

niri msg --json event-stream | jq --unbuffered -r 'keys[]' | while read -r event; do
    case "$event" in
    "WorkspaceActivated" | "WorkspacesChanged" | "OutputsChanged")
        update_xft_dpi
        ;;
    esac
done
