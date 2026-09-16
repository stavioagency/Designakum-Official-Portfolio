#!/bin/sh
# Collects the two secrets for the new Supabase project, without either passing
# through chat. They go to .env.tools, which nothing in the app reads and no
# build can see — see scripts/cf-build.sh for why that distinction exists.
#
# Only the password is asked for, not the whole connection string: the rest of
# it is derived from the project ref and region, which are not secret, and
# Supabase keeps moving where the string lives in their UI.

set -eu

env_file="$(cd "$(dirname "$0")/.." && pwd)/.env.tools"
touch "$env_file"

save() {
  key="$1"
  grep -v "^$key=" "$env_file" > "$env_file.tmp" 2>/dev/null || true
  mv "$env_file.tmp" "$env_file"
  printf '%s=%s\n' "$key" "$2" >> "$env_file"
}

printf '\n1 of 2 \xe2\x80\x94 DATABASE PASSWORD\n'
printf 'Supabase \xe2\x86\x92 the NEW project \xe2\x80\x9cDesignakum Platform (us-east-1)\xe2\x80\x9d\n'
printf '  \xe2\x86\x92 Project Settings \xe2\x86\x92 Database \xe2\x86\x92 Database password \xe2\x86\x92 Reset password\n'
printf 'Copy what it generates. Just the password, nothing else.\n\n> '
IFS= read -r pw
pw="$(printf '%s' "$pw" | tr -d '\r\n')"

printf '\n2 of 2 \xe2\x80\x94 SERVICE ROLE KEY\n'
printf 'Same project \xe2\x86\x92 Project Settings \xe2\x86\x92 API Keys \xe2\x86\x92 service_role \xe2\x86\x92 Reveal\n\n> '
IFS= read -r svc
svc="$(printf '%s' "$svc" | tr -d '[:space:]')"
svc="$(printf '%s' "$svc" | sed -E 's/(.+)\1+$/\1/')"

clear 2>/dev/null || printf '\033[2J\033[H'

fail=0
[ -z "$pw" ] && { printf 'No password entered \xe2\x80\x94 nothing saved.\n'; fail=1; }
case "$pw" in
  *"[YOUR-PASSWORD]"*|*"postgresql://"*)
    printf 'That looks like the whole connection string, not the password.\n'
    printf 'Paste only the password part.\n'; fail=1 ;;
esac
[ "${#svc}" -lt 30 ] && { printf 'That service_role key looks too short \xe2\x80\x94 nothing saved.\n'; fail=1; }
[ "$fail" = "1" ] && exit 1

save NEW_SUPABASE_DB_PASSWORD "$pw"
save NEW_SUPABASE_SERVICE_KEY "$svc"
chmod 600 "$env_file"

printf 'Saved both to .env.tools (gitignored).\n'
printf 'Screen cleared. Tell Claude they are saved.\n'
