#!/usr/bin/env bash
set -euo pipefail

restore_latest() {
  npx supabase db reset --local >/dev/null 2>&1 || true
}
trap restore_latest EXIT

npx supabase db reset --local --version 202608180001 --no-seed
docker exec -i supabase_db_cafe-scout psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/review_hardening_upgrade_setup.sql
npx supabase migration up --local
docker exec -i supabase_db_cafe-scout psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/review_hardening_upgrade_assert.sql

npx supabase db reset --local
trap - EXIT
