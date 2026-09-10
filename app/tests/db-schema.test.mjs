import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../supabase/schema.sql", import.meta.url);
const schema = (await readFile(schemaUrl, "utf8")).toLowerCase();
const frontendFiles = [
  new URL("../src/lib/databaseConfig.js", import.meta.url),
  new URL("../src/lib/supabase.js", import.meta.url),
  new URL("../src/data/ecodumpRepository.js", import.meta.url),
];

const protectedTables = [
  "organizations",
  "profiles",
  "memberships",
  "projects",
  "sites",
  "vehicles",
  "drivers",
  "route_plans",
  "transport_orders",
  "vehicle_positions",
  "audit_logs",
];

test("all application tables explicitly enable row level security", () => {
  for (const table of protectedTables) {
    assert.match(
      schema,
      new RegExp(`alter table public\\.${table} enable row level security`),
      `${table} must enable RLS`,
    );
  }
});

test("anonymous users receive no direct table grants", () => {
  assert.doesNotMatch(schema, /grant\s+.+\s+to\s+anon\b/);
});

test("organization access helper is not callable by public or anon", () => {
  assert.match(
    schema,
    /revoke all on function private\.has_org_access\(uuid\) from public, anon/,
  );
  assert.match(
    schema,
    /grant execute on function private\.has_org_access\(uuid\) to authenticated/,
  );
});

test("frontend source never contains a service role credential", async () => {
  for (const file of frontendFiles) {
    const source = (await readFile(file, "utf8")).toLowerCase();
    assert.doesNotMatch(source, /service[_-]?role/);
  }
});
