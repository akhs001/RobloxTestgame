#!/bin/sh
# Bundles src/ + three.js into a single game.js so index.html works when opened directly (file://).
npx esbuild src/main.js --bundle --minify --format=iife --outfile=game.js --log-level=warning
