#!/usr/bin/bash
node src/scripts/prebuild.ts
pnpm build:server
node src/scripts/static-render.ts
pnpm build:client
node src/scripts/build-output.ts