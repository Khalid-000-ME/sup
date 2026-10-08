#!/usr/bin/env bash
# Starts a real Canton 3.x participant + synchronizer ("sandbox") with the JSON Ledger API on :6864.
# Canton requires JDK 17 or 21 (JDK 25 breaks Canton's JCE provider check).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${JAVA_HOME:-}" ]; then
  for c in /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 /usr/lib/jvm/java-21-openjdk-amd64 /usr/lib/jvm/java-17-openjdk-amd64; do
    [ -x "$c/bin/java" ] && export JAVA_HOME="$c" && break
  done
fi
[ -n "${JAVA_HOME:-}" ] || { echo "Install JDK 21 (brew install openjdk@21) or set JAVA_HOME"; exit 1; }
export PATH="$JAVA_HOME/bin:$HOME/.dpm/bin:$PATH"
command -v dpm >/dev/null || { echo "Install dpm: curl -sSL https://get.digitalasset.com/install/install.sh | sh"; exit 1; }

echo "JAVA_HOME=$JAVA_HOME"
if [ ! -f "$ROOT/daml/sup/.daml/dist/sup-0.3.0.dar" ]; then
  (cd "$ROOT/daml/sup" && dpm build)
fi
mkdir -p "$ROOT/ledger"
cd "$ROOT/ledger"
exec dpm sandbox --no-tty --log-file-appender off
