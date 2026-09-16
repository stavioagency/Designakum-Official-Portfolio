#!/bin/sh
# Saves an API token into .env.tools without it passing through chat.
#
#   sh scripts/save-token.sh VERCEL_TOKEN
#
# .env.tools holds credentials for tooling, never for the application. Nothing
# Next reads at build time may contain them: OpenNext copies the build-time
# environment into the Worker bundle, which is how a Cloudflare API token once
# ended up deployed inside a Worker.
#
# The echo is deliberately left ON. An earlier version hid it, so pasting gave no
# feedback of any kind — it got pasted five times, and the concatenation was only
# caught when the API rejected the header. Seeing it briefly in your own terminal
# beats not knowing whether anything happened; the screen clears immediately.

set -eu

key="${1:-}"
if [ -z "$key" ]; then
  printf 'Which token? e.g. sh scripts/save-token.sh VERCEL_TOKEN\n'
  exit 1
fi

env_file="$(cd "$(dirname "$0")/.." && pwd)/.env.tools"

printf 'Paste your %s, then press Enter.\n' "$key"
printf 'Paste ONCE \xe2\x80\x94 it will appear on screen, and the screen is cleared after.\n\n> '

IFS= read -r token

# A paste can carry stray whitespace, and a repeated paste concatenates.
token="$(printf '%s' "$token" | tr -d '[:space:]')"
token="$(printf '%s' "$token" | sed -E 's/(.+)\1+$/\1/')"

clear 2>/dev/null || printf '\033[2J\033[H'

if [ -z "$token" ]; then
  printf 'Nothing pasted. Run it again when you have the token.\n'
  exit 1
fi

if [ "${#token}" -lt 20 ]; then
  printf 'That is only %s characters \xe2\x80\x94 too short. Nothing saved.\n' "${#token}"
  exit 1
fi

touch "$env_file"
grep -v "^$key=" "$env_file" > "$env_file.tmp" 2>/dev/null || true
mv "$env_file.tmp" "$env_file"
printf '%s=%s\n' "$key" "$token" >> "$env_file"
chmod 600 "$env_file"

printf 'Saved %s (%s characters) to .env.tools, which is gitignored.\n' "$key" "${#token}"
printf 'Screen cleared. Tell Claude it is saved.\n'
