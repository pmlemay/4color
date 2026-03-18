#!/bin/bash
# Quick commit, push, and deploy to GitHub Pages
set -e

cd "$(dirname "$0")/.."

# Stage all changes
git add -A

# Commit with a default message (or pass one as argument)
MSG="${1:-Update puzzles and assets}"
git commit -m "$MSG"

# Push to origin
git push

# Deploy to GitHub Pages
npm run deploy

echo "Shipped!"
