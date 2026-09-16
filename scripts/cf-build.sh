#!/bin/sh
# Builds the Cloudflare Worker with no local environment in scope.
#
# OpenNext writes whatever `next build` could see into `next-env.mjs` inside the
# bundle. The production half of that object is what the deployed Worker reads
# and it is populated from Worker secrets, but the development half is written
# from local .env files — so a bundle built on a developer's machine carries
# that developer's credentials inside the deployed script. It carried a
# Cloudflare API token once, which is what prompted this.
#
# Hiding the files for the duration is blunt and it is reliable: nothing can be
# baked in that the build cannot see.

# NOTE: this writes to .next, which `next dev` also uses — OpenNext reads that
# directory by name and will not take another. Stop the dev server first, or
# restart it afterwards; a build underneath a running dev server leaves it
# serving 500s from chunks that moved.

set -eu
cd "$(dirname "$0")/.."

hidden=""
restore() {
  for f in $hidden; do [ -f "$f.cfbuild-hidden" ] && mv "$f.cfbuild-hidden" "$f"; done
}
trap restore EXIT INT TERM

for f in .env.local .env.development.local .env.production.local .env; do
  if [ -f "$f" ]; then mv "$f" "$f.cfbuild-hidden"; hidden="$hidden $f"; fi
done

node scripts/brand-manifest.mjs
BUILD_STANDALONE=1 next build
opennextjs-cloudflare build --skipNextBuild
