#!/usr/bin/env bash
# Lint and package an (unsigned) .xpi into web-ext-artifacts/.
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes web-ext@8.3.0 lint --source-dir . --ignore-files 'docs/**' 'scripts/**' 'icons/icon-128.png'
npx --yes web-ext@8.3.0 build --source-dir . --overwrite-dest --filename calm-youtube.xpi \
  --ignore-files 'docs/**' 'scripts/**' 'icons/icon-128.png' 'README.md'
