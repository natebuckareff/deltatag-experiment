#!/usr/bin/bash
node src/scripts/prebuild.ts
pnpm build:server
node .build/ssr/entry-server.js
pnpm build:client