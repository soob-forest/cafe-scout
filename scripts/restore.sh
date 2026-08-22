#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:-}"
if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
  echo "Usage: scripts/restore.sh <backup-directory>" >&2
  exit 1
fi

node scripts/backup-manifest.mjs verify "$backup_dir"

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Set CONFIRM_RESTORE=yes after verifying the target is an empty recovery project." >&2
  exit 1
fi

if [[ "${SUPABASE_TARGET:-linked}" == "local" ]]; then
  if [[ "${RESTORE_DATA_ONLY:-}" != "yes" || -z "${SUPABASE_DB_CONTAINER:-}" ]]; then
    echo "Local drill requires RESTORE_DATA_ONLY=yes and an explicit SUPABASE_DB_CONTAINER after db reset --no-seed." >&2
    exit 1
  fi
  docker cp "$backup_dir/data.sql" "$SUPABASE_DB_CONTAINER:/tmp/cafe-scout-restore-data.sql"
  docker exec "$SUPABASE_DB_CONTAINER" psql --single-transaction -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c 'set session_replication_role = replica' -f /tmp/cafe-scout-restore-data.sql
else
  if [[ -z "${TARGET_SUPABASE_DB_URL:-}" ]]; then
    echo "TARGET_SUPABASE_DB_URL is required." >&2
    exit 1
  fi
  if [[ -z "${TARGET_SUPABASE_PROJECT_REF:-}" ]]; then
    echo "TARGET_SUPABASE_PROJECT_REF is required." >&2
    exit 1
  fi
  if [[ "${CONFIRM_RESTORE_PROJECT_REF:-}" != "$TARGET_SUPABASE_PROJECT_REF" ]]; then
    echo "Set CONFIRM_RESTORE_PROJECT_REF to the exact target project ref." >&2
    exit 1
  fi
  node scripts/verify-supabase-target.mjs TARGET_SUPABASE_DB_URL TARGET_SUPABASE_PROJECT_REF
  echo "Restoring DB and Storage to verified project: $TARGET_SUPABASE_PROJECT_REF"
  if ! command -v psql >/dev/null 2>&1; then
    echo "PostgreSQL psql is required for restore." >&2
    exit 1
  fi
  psql --single-transaction --variable ON_ERROR_STOP=1 \
    --file "$backup_dir/roles.sql" \
    --file "$backup_dir/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "$backup_dir/data.sql" \
    --dbname "$TARGET_SUPABASE_DB_URL"
fi

if [[ "${SUPABASE_TARGET:-linked}" == "local" ]]; then
  storage_target=(--local)
else
  storage_target=(--project-ref "$TARGET_SUPABASE_PROJECT_REF")
fi

storage_root="$backup_dir/storage/cafe-photos"
if [[ -d "$storage_root" ]]; then
  while IFS= read -r -d '' object_file; do
    object_path="${object_file#"$storage_root"/}"
    case "${object_file##*.}" in
      [jJ][pP][gG]|[jJ][pP][eE][gG]) content_type="image/jpeg" ;;
      [pP][nN][gG]) content_type="image/png" ;;
      [wW][eE][bB][pP]) content_type="image/webp" ;;
      *) echo "Unsupported backup object type: $object_path" >&2; exit 1 ;;
    esac
    npx supabase --experimental storage cp "${storage_target[@]}" \
      --content-type "$content_type" "$object_file" "ss:///cafe-photos/$object_path"
  done < <(find "$storage_root" -type f -print0)
fi

echo "Restore completed. Run the verification checklist in docs/RECOVERY.md before switching traffic."
