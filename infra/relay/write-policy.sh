#!/bin/sh
# strfry write policy plugin for ACARS
# Only accepts kind 30078/30079 events with d-tags starting with "airtr:"
# Pure POSIX sh — no jq required (Alpine/busybox compatible)

while read -r line; do
    # Extract event id (quoted string)
    evid=$(echo "$line" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id"://')

    # Extract kind (number)
    kind=$(echo "$line" | grep -o '"kind":[0-9]*' | head -1 | sed 's/"kind"://')

    if [ "$kind" = "30078" ] || [ "$kind" = "30079" ]; then
        # Check if any d-tag value starts with "airtr:"
        if echo "$line" | grep -q '"d","airtr:'; then
            echo "{\"id\":$evid,\"action\":\"accept\",\"msg\":\"\"}"
        else
            echo "{\"id\":$evid,\"action\":\"reject\",\"msg\":\"only airtr: d-tags accepted\"}"
        fi
    else
        echo "{\"id\":$evid,\"action\":\"reject\",\"msg\":\"only kind 30078/30079 accepted\"}"
    fi
done
