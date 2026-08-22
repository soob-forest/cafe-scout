#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:-backups/$(date -u +%Y%m%dT%H%M%SZ)}"

if [[ -e "$backup_dir" ]]; then
  if [[ ! -d "$backup_dir" || -n "$(find "$backup_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "Backup directory must not exist or must be empty: $backup_dir" >&2
    exit 1
  fi
fi

if [[ "${SUPABASE_TARGET:-linked}" == "local" ]]; then
  db_target=(--local)
  storage_target=(--local)
  source_project_ref="local"
else
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "SUPABASE_DB_URL is required unless SUPABASE_TARGET=local." >&2
    exit 1
  fi
  if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    echo "SUPABASE_PROJECT_REF is required for a hosted backup." >&2
    exit 1
  fi
  node scripts/verify-supabase-target.mjs SUPABASE_DB_URL SUPABASE_PROJECT_REF
  db_target=(--db-url "$SUPABASE_DB_URL")
  storage_target=(--project-ref "$SUPABASE_PROJECT_REF")
  source_project_ref="$SUPABASE_PROJECT_REF"
fi

mkdir -p "$backup_dir/storage"

npx supabase db dump "${db_target[@]}" --file "$backup_dir/roles.sql" --role-only
npx supabase db dump "${db_target[@]}" --file "$backup_dir/schema.sql"

inventory_before="$(mktemp)"
inventory_after="$(mktemp)"
cleanup_inventory() {
  rm -f "$inventory_before" "$inventory_after"
}
trap cleanup_inventory EXIT

capture_photo_inventory() {
  npx supabase db query "${db_target[@]}" --output json \
    "select object_path from public.cafe_photos order by object_path" \
    | node scripts/photo-inventory.mjs normalize
}

capture_photo_inventory > "$inventory_before"
npx supabase db dump "${db_target[@]}" --file "$backup_dir/data.sql" --data-only --use-copy --schema "auth,public"
npx supabase --experimental storage cp "${storage_target[@]}" --recursive ss:///cafe-photos "$backup_dir/storage"
mkdir -p "$backup_dir/storage/cafe-photos"
capture_photo_inventory > "$inventory_after"

node scripts/photo-inventory.mjs verify \
  "$inventory_before" \
  "$inventory_after" \
  "$backup_dir/storage/cafe-photos" \
  "$backup_dir/photo-paths.json"

node scripts/backup-manifest.mjs create "$backup_dir" "$source_project_ref"

echo "Backup written to $backup_dir. Encrypt it and copy it off-site."
