#!/usr/bin/env bash
# Polite Berth plate backfill in tmux session `tvc-plate-backfill`.
#
# Attach:  tmux attach -t tvc-plate-backfill
# Tail log: tail -f .data/berth-plates-backfill.log
# Progress: cat .data/berth-plates-progress.json | head
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SESSION="tvc-plate-backfill"
LOG_FILE=".data/berth-plates-backfill.log"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

mkdir -p .data

if tmux_cmd has-session -t "=$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already running."
  echo "  Attach:  tmux attach -t $SESSION"
  echo "  Tail:    tail -f $LOG_FILE"
  exit 0
fi

CMD="node scripts/batch-berth-plates.mjs 2>&1 | tee -a $LOG_FILE"
tmux_cmd new-session -d -s "$SESSION" -c "$ROOT" -- "${SHELL:-bash}" -lc "$CMD"

echo "Started plate backfill in tmux session '$SESSION'."
echo "  Attach:  tmux attach -t $SESSION"
echo "  Tail:    tail -f $LOG_FILE"
echo "  Failed:  cat .data/berth-plates-failed.json"
echo "  Progress: cat .data/berth-plates-progress.json"
