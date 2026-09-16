#!/bin/sh
# Saves a Cloudflare API token into .env.local without it passing through chat.
#
# The echo is deliberately left ON. An earlier version hid it, and the result was
# a paste with no feedback of any kind — so it got pasted five times, and the
# concatenation was only caught because the API rejected the header. Seeing the
# token briefly in your own terminal is a far smaller problem than not knowing
# whether anything happened, and the screen is cleared immediately after.

set -eu

env_file="$(cd "$(dirname "$0")/.." && pwd)/.env.local"

printf 'Paste your Cloudflare API token, then press Enter.\n'
printf 'Paste ONCE \xe2\x80\x94 it will appear on screen, and the screen is cleared after.\n\n> '

IFS= read -r token

# A paste can carry stray whitespace, and a repeated paste concatenates.
token="$(printf '%s' "$token" | tr -d '[:space:]')"
# Keep only the first token if it was pasted more than once.
token="$(printf '%s' "$token" | sed -E 's/(.+)\1+$/\1/')"

clear 2>/dev/null || printf '\033[2J\033[H'

if [ -z "$token" ]; then
  printf 'Nothing pasted. Run this again when you have the token.\n'
  exit 1
fi

if [ "${#token}" -lt 20 ]; then
  printf 'That is only %s characters \xe2\x80\x94 too short for a Cloudflare token.\n' "${#token}"
  printf 'Nothing was saved.\n'
  exit 1
fi

touch "$env_file"
grep -v '^CLOUDFLARE_API_TOKEN=' "$env_file" > "$env_file.tmp" 2>/dev/null || true
mv "$env_file.tmp" "$env_file"
printf 'CLOUDFLARE_API_TOKEN=%s\n' "$token" >> "$env_file"
chmod 600 "$env_file"

printf 'Saved %s characters to .env.local (gitignored).\n' "${#token}"
printf 'Screen cleared. Tell Claude it is saved.\n'
