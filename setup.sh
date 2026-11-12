#!/bin/bash
# one-time setup for a teammate's mac. safe to run again: it never overwrites a file you already have.
#   ./setup.sh                      asks for the muse key if web/.env.local is missing
#   MODEL_API_KEY=... ./setup.sh    same, without the prompt
set -e
cd "$(dirname "$0")"
say() { printf '\n== %s\n' "$1"; }

missing=""
for t in docker supabase pnpm xcodebuild; do command -v "$t" >/dev/null || missing="$missing $t"; done
if [ -n "$missing" ]; then
  echo "install these first:$missing"
  echo "  docker: Docker Desktop   supabase: brew install supabase/tap/supabase   pnpm: npm i -g pnpm   xcodebuild: Xcode 16+"
  exit 1
fi

say "signing"
if [ -f ios/Local.xcconfig ]; then
  echo "ios/Local.xcconfig exists, leaving it alone"
else
  # the team id is the OU field of your apple development certificate
  team=$(security find-certificate -a -c "Apple Development" -p 2>/dev/null | openssl x509 -noout -subject -nameopt multiline 2>/dev/null | awk -F'= ' '/organizationalUnitName/ {print $2; exit}')
  me=$(id -un | tr -cd 'A-Za-z0-9-')
  if [ -n "$team" ]; then
    printf 'DEVELOPMENT_TEAM = %s\nMUSING_BUNDLE_ID = com.musing.%s\n' "$team" "$me" > ios/Local.xcconfig
    echo "wrote ios/Local.xcconfig for team $team"
  else
    echo "no apple development certificate on this mac yet."
    echo "add your apple id in Xcode > Settings > Accounts, pick your team once under"
    echo "target Musing > Signing & Capabilities, then run this script again (optional)."
  fi
fi

say "database"
supabase status >/dev/null 2>&1 || supabase start
vars=$(supabase status -o env 2>/dev/null)
get() { printf '%s\n' "$vars" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" | head -1; }
api=$(get API_URL); anon=$(get ANON_KEY); service=$(get SERVICE_ROLE_KEY)
[ -n "$api" ] && [ -n "$anon" ] && [ -n "$service" ] || { echo "could not read keys from 'supabase status'"; exit 1; }
api=${api/127.0.0.1/localhost}

say "server config"
fresh=0
if [ -f web/.env.local ]; then
  echo "web/.env.local exists, leaving it alone"
else
  key="$MODEL_API_KEY"
  if [ -z "$key" ] && [ -t 0 ]; then printf 'paste the muse key (MODEL_API_KEY), or press enter to skip: '; read -rs key; echo; fi
  [ -n "$key" ] || echo "no muse key given: the app will run with muse off until you add MODEL_API_KEY to web/.env.local"
  ( umask 077; printf 'MODEL_API_KEY=%s\nNEXT_PUBLIC_SUPABASE_URL=%s\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$key" "$api" "$anon" "$service" > web/.env.local )
  echo "wrote web/.env.local"; fresh=1
fi
if [ -f ios/.env ]; then
  echo "ios/.env exists, leaving it alone"
else
  printf 'API_URL=http://localhost:3000\nSUPABASE_URL=%s\nSUPABASE_ANON_KEY=%s\n' "$api" "$anon" > ios/.env
  echo "wrote ios/.env"
fi

say "packages"
( cd web && pnpm install --silent )
if [ "$fresh" = 1 ] && [ -z "$SKIP_SEED" ]; then say "demo data"; ( cd web && pnpm seed ); fi

say "done"
echo "1. cd web && pnpm dev          (leave it running)"
echo "2. open ios/Musing.xcodeproj   plug in your phone, pick it at the top, press run"
