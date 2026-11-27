#!/usr/bin/env bash
set -euo pipefail

root=/opt/roomlink
archive="$root/roomlink-release.tar.gz"
cd "$root"
staged=$(mktemp -d "$root/.release.XXXXXX")
old_current=
switched=false

cleanup() {
  local code=$?
  trap - EXIT
  cd "$root"
  if (( code != 0 )); then
    if [[ $switched == true ]]; then
      mv "$root/current" "$staged"
    fi
    if [[ -n $old_current && -d $old_current ]]; then
      mv "$old_current" "$root/current"
      rmdir "$rollback_dir"
      sudo -n systemctl restart roomlink || echo "No se pudo reiniciar la versión anterior." >&2
    fi
  fi
  rm -rf "$staged"
  rm -f "$archive"
  exit "$code"
}
trap cleanup EXIT

tar -xzf "$archive" -C "$staged"
test -s "$staged/dist/src/server.js"
test -s "$staged/dist/src/db/migrate.js"
test -s "$staged/public/index.html"

if [[ -d previous/uploads && ! -L previous/uploads ]] &&
    [[ -n $(find previous/uploads -type f -print -quit) ]]; then
  echo "La versión anterior tiene fotos locales. Rescátalas antes del despliegue." >&2
  exit 1
fi

cd "$staged"
npm ci --omit=dev

migrated=false
cd "$staged"
for attempt in $(seq 1 12); do
  if node --env-file="$root/.env" dist/src/db/migrate.js; then
    migrated=true
    break
  fi
  sleep 5
done
if [[ $migrated != true ]]; then
  echo "Las migraciones fallaron. Se conserva la versión activa." >&2
  exit 1
fi

cd "$root"
if [[ -d current/uploads && ! -L current/uploads ]]; then
  if [[ -e uploads || -L uploads ]]; then
    echo "Hay dos carpetas de fotos. Consolídalas antes del despliegue." >&2
    exit 1
  fi
  mv current/uploads uploads
  ln -s "$root/uploads" current/uploads
else
  mkdir -p uploads
fi
ln -s "$root/uploads" "$staged/uploads"

# El workflow android-release.yml publica el APK aparte; sobrevive a cada release.
mkdir -p downloads
ln -s "$root/downloads" "$staged/public/descargas"

if [[ -d current ]]; then
  rollback_dir=$(mktemp -d "$root/.rollback.XXXXXX")
  old_current="$rollback_dir/current"
  mv current "$old_current"
fi
mv "$staged" current
switched=true

sudo -n systemctl restart roomlink
ready=false
for attempt in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/ready \
      | node -e 'let body = ""; process.stdin.on("data", c => body += c); process.stdin.on("end", () => { try { const r = JSON.parse(body); if (r.status === "ready" && r.database === "connected") return; } catch {} process.exitCode = 1; });'; then
    ready=true
    break
  fi
  sleep 3
done
if [[ $ready != true ]]; then
  echo "La nueva versión no está lista. Se intentará restaurar la anterior." >&2
  exit 1
fi

if [[ -n $old_current ]]; then
  rm -rf previous
  mv "$old_current" previous
  rmdir "$rollback_dir"
fi
