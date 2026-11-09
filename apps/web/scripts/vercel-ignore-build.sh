#!/bin/sh
# Vercel Ignored Build Step, wired up in apps/web/vercel.json.
# Vercel's contract: exit 0 skips the build, exit 1 runs it.
#
# Every deployment stores a full copy of the static export (about 60 MB, mostly
# the basemap), so a commit that cannot change the site should not create one.
#
# Compares against VERCEL_GIT_PREVIOUS_SHA (last successful deployment on this
# branch) rather than HEAD^, so changes in a skipped commit are never lost.
# Anything uncertain builds: a needless build costs storage, a wrong skip
# leaves the site stale.

prev="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$prev" ]; then
  echo "vercel-ignore-build: no previous deployment on this branch, building"
  exit 1
fi

# Vercel clones shallowly, so an older SHA may not be present.
if ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  echo "vercel-ignore-build: $prev not in clone, building"
  exit 1
fi

# The ":/" pathspec is relative to the repo root, since this runs in apps/web.
git diff --quiet "$prev" HEAD -- \
  ':/apps/web' \
  ':/data' \
  ':/packages' \
  ':/scripts' \
  ':/package.json' \
  ':/bun.lock' \
  ':/tsconfig.base.json'

# git diff exits 1 for "changed" and 128 for an error; both must build.
if [ $? -eq 0 ]; then
  echo "vercel-ignore-build: no site inputs changed since $prev, skipping"
  exit 0
fi

echo "vercel-ignore-build: site inputs changed or diff failed, building"
exit 1
