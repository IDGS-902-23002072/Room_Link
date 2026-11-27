#!/usr/bin/env bash
# Ejecutado desde la raíz del repo por GitHub Actions. Requiere apk/roomlink.apk,
# SSH_HOST/USER/KEY/KNOWN_HOSTS, API_URL, RUNNER_TEMP y GITHUB_RUN_ID/ATTEMPT.
set -euo pipefail
for name in SSH_HOST SSH_USER SSH_KEY SSH_KNOWN_HOSTS API_URL RUNNER_TEMP GITHUB_RUN_ID GITHUB_RUN_ATTEMPT; do
  : "${!name:?Falta $name}"
done
[[ $GITHUB_RUN_ID =~ ^[0-9]+$ && $GITHUB_RUN_ATTEMPT =~ ^[0-9]+$ ]]
(cd apk && sha256sum --check roomlink.apk.sha256)
expected=$(sha256sum apk/roomlink.apk | cut -d ' ' -f 1)
stage=".apk-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
ssh_dir=$(mktemp -d "$RUNNER_TEMP/apk-ssh.XXXXXX")
trap 'rm -rf "$ssh_dir"' EXIT
chmod 700 "$ssh_dir"
printf '%s\n' "$SSH_KEY" > "$ssh_dir/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/"*
options=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -o "UserKnownHostsFile=$ssh_dir/known_hosts" -i "$ssh_dir/key")
target="$SSH_USER@$SSH_HOST"
ssh "${options[@]}" "$target" "mkdir -p /opt/roomlink/downloads/$stage"
scp "${options[@]}" apk/roomlink.apk "$target:/opt/roomlink/downloads/$stage/roomlink.apk"
ssh "${options[@]}" "$target" bash -s -- "$stage" "$expected" <<'REMOTE'
set -euo pipefail
stage=$1
expected=$2
[[ $stage =~ ^\.apk-[0-9]+-[0-9]+$ && $expected =~ ^[a-f0-9]{64}$ ]]
cd /opt/roomlink/downloads
trap 'rm -rf -- "$stage"' EXIT
printf '%s  %s/roomlink.apk\n' "$expected" "$stage" | sha256sum --check
chmod 644 "$stage/roomlink.apk"
# Conserva el APK anterior; rename en el mismo filesystem evita descargas parciales.
if [[ -f roomlink.apk ]]; then cp -p roomlink.apk roomlink.previous.apk; fi
mv -f "$stage/roomlink.apk" roomlink.apk
REMOTE
curl --fail --silent --show-error --location --retry 3 --max-time 120 \
  "$API_URL/descargas/roomlink.apk?build=$GITHUB_RUN_ID" -o "$ssh_dir/downloaded.apk"
actual=$(sha256sum "$ssh_dir/downloaded.apk" | cut -d ' ' -f 1)
if [[ $actual != "$expected" ]]; then
  echo 'El APK descargado por HTTPS no coincide con el compilado. Se conserva roomlink.previous.apk para recuperación.' >&2
  exit 1
fi
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf '### APK publicado\n\n[Descargar RoomLink](%s/descargas/roomlink.apk)\n\nSHA-256: `%s`\n' "$API_URL" "$expected" >> "$GITHUB_STEP_SUMMARY"
fi
