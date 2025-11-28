#!/usr/bin/bash
node src/scripts/prebuild.ts
pnpm build:server
node src/scripts/static-render.ts
if ls .build/generated/client/entry-*.tsx >/dev/null 2>&1; then
  pnpm build:client
else
  echo "No client entries found, skipping client build."
  mkdir -p .build/bundle/client/.vite
  echo '{}' > .build/bundle/client/.vite/manifest.json
fi
node src/scripts/build-output.ts
