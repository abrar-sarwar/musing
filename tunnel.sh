#!/bin/bash
# gives the server on this mac a temporary internet address, so phones work without the
# cable and on any network. leave it running; ctrl-c closes the address.
#   needs: cloudflared (brew install cloudflared), `pnpm dev` and `supabase start` already running.
# anyone with the address can use the prototype (and your muse key) while this runs.
set -e
cd "$(dirname "$0")"
command -v cloudflared >/dev/null || { echo "install cloudflared first: brew install cloudflared"; exit 1; }
curl -s -m 5 -o /dev/null http://localhost:3000/api/health || { echo "the api server is not running. start it: cd web && pnpm dev"; exit 1; }

node web/scripts/tunnel-proxy.mjs &
proxy=$!
trap 'kill $proxy 2>/dev/null' EXIT
sleep 1

echo "opening the tunnel..."
cloudflared tunnel --no-autoupdate --url http://localhost:3080 2>&1 | while IFS= read -r line; do
  url=$(printf '%s' "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' || true)
  if [ -n "$url" ] && [ -z "$shown" ]; then
    shown=1
    printf '\n  server address for the phones:\n\n      %s\n\n  in the app: profile > wrench icon (Developer) > paste it > Save and test.\n  or open this link on the phone:  musing://developer?server=%s\n  it changes every time this script restarts.\n\n' "$url" "$url"
    # no typing: scan this with the iphone camera and tap "open in musing."
    if command -v qrencode >/dev/null; then
      qrencode -t ANSIUTF8 "musing://developer?server=$url"
      qr="${TMPDIR:-/tmp}/musing-server-qr.png"
      qrencode -s 14 -m 3 -o "$qr" "musing://developer?server=$url" && open "$qr"
      echo "  scan the code with the phone camera. it is also open in Preview for a big screen."
    else
      echo "  for a scannable code: brew install qrencode"
    fi
  fi
done
