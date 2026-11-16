#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'Automatic symlink hooks are retired; this command makes no changes.' \
  'Use pnpm ops pre doctor --scope links for read-only checks, or pnpm ops pre repair links explicitly.' \
  'Audit shared post-checkout/post-merge hooks for # scholarseed-symlink-fix.' \
  'Back up and remove only the verified project block with explicit authorization; preserve third-party content and core.hooksPath.'
