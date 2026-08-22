import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shouldDelete = process.argv.includes("--delete");
const minimumAgeMs = Number(process.env.ORPHAN_MINIMUM_AGE_HOURS ?? "1") * 60 * 60 * 1000;

if (!url || !serviceKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Use this only from an operator workstation.",
  );
}
if (shouldDelete && process.env.CONFIRM_DELETE_ORPHAN_PHOTOS !== "yes") {
  throw new Error("Set CONFIRM_DELETE_ORPHAN_PHOTOS=yes to confirm deletion.");
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function listFiles(prefix = "") {
  const found = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from("cafe-photos")
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error("Storage 목록을 읽지 못했습니다.");
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) found.push({ path, createdAt: item.created_at });
      else found.push(...(await listFiles(path)));
    }
    if (!data || data.length < 100) break;
  }
  return found;
}

const [{ data: metadata, error: metadataError }, files] = await Promise.all([
  supabase.from("cafe_photos").select("object_path"),
  listFiles(),
]);
if (metadataError) throw new Error("사진 metadata를 읽지 못했습니다.");

const registered = new Set((metadata ?? []).map((item) => item.object_path));
const cutoff = Date.now() - minimumAgeMs;
const orphans = files.filter(
  (file) => !registered.has(file.path) && new Date(file.createdAt).getTime() < cutoff,
);

console.log(
  `검사 object ${files.length}개 · DB metadata ${registered.size}개 · 정리 후보 ${orphans.length}개`,
);
orphans.forEach((file) => console.log(file.path));

if (shouldDelete && orphans.length) {
  for (let index = 0; index < orphans.length; index += 100) {
    const { error } = await supabase.storage
      .from("cafe-photos")
      .remove(orphans.slice(index, index + 100).map((file) => file.path));
    if (error) throw new Error("일부 고아 object를 삭제하지 못했습니다. 다시 dry-run으로 확인하세요.");
  }
  console.log(`고아 object ${orphans.length}개를 삭제했습니다.`);
}
