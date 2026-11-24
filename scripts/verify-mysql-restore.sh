#!/usr/bin/env bash
set -euo pipefail

source_database=${1:?Base de origen requerida}
target_database=${2:?Base de restauración requerida}
if [[ ! $source_database =~ ^[a-zA-Z0-9_]+$ || ! $target_database =~ ^[a-zA-Z0-9_]+_qa_restore$ || $source_database == "$target_database" ]]; then
  echo 'La restauración requiere una base de destino QA separada con sufijo _qa_restore.' >&2
  exit 1
fi
connection=(-h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "${DB_USER:-roomlink_app}")
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
umask 077
schema_counts() {
  mysql "${connection[@]}" -N "$1" -e '
    SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE="BASE TABLE"),
           (SELECT COUNT(*) FROM information_schema.views WHERE TABLE_SCHEMA=DATABASE()),
           (SELECT COUNT(*) FROM information_schema.triggers WHERE TRIGGER_SCHEMA=DATABASE());'
}
[[ $(schema_counts "$target_database") == $'0\t0\t0' ]]
tables=(auth_users room_listings app_applications)
mysql_snapshot() {
  for table in "${tables[@]}"; do
    mysql "${connection[@]}" -N "$1" -e "SELECT COUNT(*) FROM $table"
  done
}
schema_counts "$source_database" > "$scratch/expected-schema"
mysql_snapshot "$source_database" > "$scratch/expected-counts"
mysqldump "${connection[@]}" --single-transaction --no-tablespaces --skip-add-drop-table --no-create-db \
  --set-gtid-purged=OFF "$source_database" > "$scratch/backup.sql"
mysql "${connection[@]}" "$target_database" < "$scratch/backup.sql"
schema_counts "$target_database" > "$scratch/actual-schema"
mysql_snapshot "$target_database" > "$scratch/actual-counts"
if [[ $(cat "$scratch/expected-schema") != "$(cat "$scratch/actual-schema")" ||
      $(cat "$scratch/expected-counts") != "$(cat "$scratch/actual-counts")" ]]; then
  echo 'La base restaurada difiere del origen.' >&2
  exit 1
fi
mysql "${connection[@]}" "$target_database" -N -e '
  SELECT (SELECT COUNT(*) FROM v_room_card),
         (SELECT COUNT(*) FROM v_profile_card),
         (SELECT COUNT(*) FROM v_accepted_connections),
         (SELECT COUNT(*) FROM v_kpis_now);' >/dev/null
echo 'Restauración QA verificada. El destino se conserva para inspección.'
