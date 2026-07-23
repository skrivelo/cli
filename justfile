# Tag the current package.json version and push — CI publishes it to npm via
# trusted publishing (no token, no OTP). See .github/workflows/publish.yml.
release:
    #!/usr/bin/env bash
    set -euo pipefail
    test -z "$(git status --porcelain)" || { echo "working tree not clean"; exit 1; }
    v="v$(node -p "require('./package.json').version")"
    git rev-parse "$v" >/dev/null 2>&1 && { echo "$v already tagged"; exit 1; }
    git tag "$v"
    git push origin main "$v"
    echo "pushed $v — publish runs in CI: gh run list --workflow=publish.yml"
