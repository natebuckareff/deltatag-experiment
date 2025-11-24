#!/usr/bin/bash
node src/scripts/prebuild-v2.ts
pnpm build:server
node src/scripts/static-render.ts
pnpm build:client