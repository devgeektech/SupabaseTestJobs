import fs from "fs";
import crypto from "crypto";
import { parse } from "csv-parse/sync";

function fail(msg) {
  console.error(msg);
  console.log("Overall: FAIL");
  process.exit(1);
}

try {
  // Validate canonical sample row header exactly
  const expectedHeader = [
    "utc_ts",
    "local_datetime",
    "timezone",
    "primary_emotion",
    "secondary_emotion",
    "energy_level",
    "context",
    "action_id",
    "action_name",
    "action_category",
    "favorited",
    "duration_seconds",
    "completed",
    "skipped",
    "reflection",
    "note_text",
  ].join(",");
  const sample = fs.readFileSync("data/canonical_sample_row.csv", "utf8").split(/\r?\n/)[0];
  const headerOk = sample.trim() === expectedHeader;

  const csv = fs.readFileSync("data/micro_actions.csv", "utf8");
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const ids = rows.map((r) => r.id);
  const count = rows.length;
  const idOk = ids.every((id) => /^act_\d{4}$/.test(id));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const baseline = JSON.parse(fs.readFileSync("data/micro_actions_baseline.json", "utf8"));
  const stableOk = baseline.length === ids.length && baseline.every((id, i) => id === ids[i]);

  // Compute a stable checksum (SHA-256) of the sorted IDs for auditing.
  const sortedIds = [...ids].sort();
  const checksum = crypto.createHash("sha256").update(sortedIds.join("\n"), "utf8").digest("hex");

  console.log(headerOk ? "✔ Canonical sample header matches expected order" : "✖ Canonical sample header mismatch");
  if (count !== 65) console.error(`Expected 65, got ${count}`);
  else console.log(`✔ Loaded micro-actions: ${count}`);
  console.log(idOk ? "✔ ID format valid" : "✖ ID format invalid");
  console.log(dupes.length === 0 ? "✔ No duplicate IDs" : `✖ Duplicates: ${[...new Set(dupes)].join(", ")}`);
  console.log(stableOk ? "✔ All IDs stable vs baseline" : "✖ IDs changed from baseline");
  console.log(`Checksum (sha256 of sorted IDs): ${checksum}`);

  if (headerOk && count === 65 && idOk && dupes.length === 0 && stableOk) {
    console.log("Overall: PASS");
    process.exit(0);
  } else {
    process.exit(1);
  }
} catch (e) {
  fail(e.message);
}

