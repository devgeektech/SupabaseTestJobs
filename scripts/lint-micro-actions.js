import fs from "fs";
import { parse } from "csv-parse/sync";

function fail(msg) {
  console.error(msg);
  console.log("Overall: FAIL");
  process.exit(1);
}

try {
  const csv = fs.readFileSync("data/micro_actions.csv", "utf8");
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const ids = rows.map((r) => r.id);
  const count = rows.length;
  const idOk = ids.every((id) => /^act_\d{4}$/.test(id));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const baseline = JSON.parse(fs.readFileSync("data/micro_actions_baseline.json", "utf8"));
  const stableOk = baseline.length === ids.length && baseline.every((id, i) => id === ids[i]);

  if (count !== 65) console.error(`Expected 65, got ${count}`);
  else console.log(`✔ Loaded micro-actions: ${count}`);
  console.log(idOk ? "✔ ID format valid" : "✖ ID format invalid");
  console.log(dupes.length === 0 ? "✔ No duplicate IDs" : `✖ Duplicates: ${[...new Set(dupes)].join(", ")}`);
  console.log(stableOk ? "✔ All IDs stable vs baseline" : "✖ IDs changed from baseline");

  if (count === 65 && idOk && dupes.length === 0 && stableOk) {
    console.log("Overall: PASS");
    process.exit(0);
  } else {
    process.exit(1);
  }
} catch (e) {
  fail(e.message);
}
