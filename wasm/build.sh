#!/usr/bin/env bash
# Build the Yaegi wasm runtime and copy the matching wasm_exec.js into public/wasm.
# Run through `pnpm build:wasm` or `mise run build:wasm` (also invoked automatically before pnpm build).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root/wasm"

out_dir="$root/public/wasm"
wasm_out="$out_dir/yaegi.wasm"
exec_out="$out_dir/wasm_exec.js"
stamp="$root/wasm/.go-version"
go_version="$(go env GOVERSION)"

mkdir -p "$out_dir"

needs_build=1
if [[ -f "$wasm_out" && -f "$exec_out" && -f "$stamp" ]]; then
  if [[ "$(cat "$stamp")" == "$go_version" ]] \
    && [[ -z "$(find . -name '*.go' -newer "$wasm_out" -print -quit)" ]] \
    && [[ -z "$(find go.mod go.sum -newer "$wasm_out" -print -quit 2>/dev/null)" ]]; then
    needs_build=0
  fi
fi

if [[ "$needs_build" == 1 ]]; then
  echo "building public/wasm/yaegi.wasm (GOOS=js GOARCH=wasm, $go_version)"
  GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$wasm_out" .
  cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$exec_out"
  printf '%s' "$go_version" > "$stamp"
else
  echo "public/wasm/yaegi.wasm is up to date ($go_version)"
fi

ls -l "$wasm_out" "$exec_out"
