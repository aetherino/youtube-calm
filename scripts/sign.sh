#!/usr/bin/env bash
# Get a Mozilla-signed .xpi (unlisted = private, not published on addons.mozilla.org)
# so regular Firefox keeps it installed across restarts.
#
# 1. Create API credentials: https://addons.mozilla.org/developers/addon/api/key/
# 2. AMO_JWT_ISSUER=... AMO_JWT_SECRET=... ./scripts/sign.sh
# 3. Open the .xpi it prints in Firefox (File → Open File…) and click Add.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${AMO_JWT_ISSUER:?set AMO_JWT_ISSUER (see comment at top)}"
: "${AMO_JWT_SECRET:?set AMO_JWT_SECRET (see comment at top)}"
npx --yes web-ext@8.3.0 sign --source-dir . --channel unlisted \
  --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET" \
  --ignore-files 'docs/**' 'scripts/**' 'icons/icon-128.png' 'README.md'
ls -1t web-ext-artifacts/*.xpi | head -1
