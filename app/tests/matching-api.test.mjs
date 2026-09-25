import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkflowServer } from "../server/workflow-api.mjs";
const tokens = {
  construction: "construction-token",
  receiving: "receiving-token",
  outsider: "outsider-token",
};
const call = async (
  base,
  role,
  path,
  { body, version, key, method = body ? "POST" : "GET" } = {},
) => {
  const r = await fetch(base + path, {
    method,
    headers: {
      authorization: `Bearer ${tokens[role]}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(version ? { "if-match": String(version) } : {}),
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
};
const newCase = (side, title) => ({
  ownerSide: side,
  title,
  region: "匿名地域",
  soilType: "第2種建設発生土",
  quantity: 100,
  unit: "m3",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  public: { summary: `${title}公開情報` },
  shared: { conditions: `${title}相談共有` },
  internal: { memo: `${title}社内秘密` },
  documents: [{ name: "匿名資料.pdf" }],
});
test("matching saves visibility-separated cases, bilateral agreement snapshot, and requested reservation", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ecodump-match-")),
    api = createWorkflowServer({ dbPath: join(dir, "db.sqlite"), port: 0 }),
    address = await api.listen(),
    base = `http://127.0.0.1:${address.port}/api`;
  t.after(async () => {
    await api.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const c = (
    await call(base, "construction", "/matching/cases", {
      body: newCase("construction", "匿名搬出案件"),
      key: "c-create",
    })
  ).body.case;
  const r = (
    await call(base, "receiving", "/matching/cases", {
      body: newCase("receiving", "匿名受入案件"),
      key: "r-create",
    })
  ).body.case;
  assert.equal(
    (
      await call(base, "construction", `/matching/cases/${c.id}/publish`, {
        body: {},
        version: 1,
        key: "c-pub",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(base, "receiving", `/matching/cases/${r.id}/publish`, {
        body: {},
        version: 1,
        key: "r-pub",
      })
    ).status,
    200,
  );
  const publicView = (await call(base, "construction", "/matching")).body.data
    .searchResults[0];
  assert.equal(publicView.internal, undefined);
  assert.equal(publicView.shared, undefined);
  const consultation = (
    await call(base, "construction", "/matching/consultations", {
      body: { sourceCaseId: c.id, targetCaseId: r.id },
      key: "consult",
    })
  ).body.consultation;
  const partnerView = (await call(base, "receiving", "/matching")).body.data
    .searchResults[0];
  assert.equal(partnerView.shared.conditions, "匿名搬出案件相談共有");
  assert.equal(partnerView.internal, undefined);
  let current = (await call(base, "construction", "/matching")).body.data
    .consultations[0];
  assert.equal(
    (
      await call(
        base,
        "construction",
        `/matching/consultations/${consultation.id}/accept`,
        { body: {}, version: current.version, key: "accept-c" },
      )
    ).status,
    200,
  );
  current = (await call(base, "receiving", "/matching")).body.data
    .consultations[0];
  const agreed = await call(
    base,
    "receiving",
    `/matching/consultations/${consultation.id}/accept`,
    { body: {}, version: current.version, key: "accept-r" },
  );
  assert.ok(agreed.body.agreement);
  const agreement = (await call(base, "construction", "/matching")).body.data
    .agreements[0];
  assert.equal(agreement.sourceCase.version, 2);
  assert.equal(agreement.terms.quantity, 100);
  await call(base, "construction", `/matching/cases/${c.id}/edit`, {
    body: { quantity: 120 },
    version: 2,
    key: "edit-after",
  });
  const unchanged = (await call(base, "construction", "/matching")).body.data
    .agreements[0];
  assert.equal(unchanged.sourceCase.quantity, 100);
  const reserved = await call(
    base,
    "construction",
    `/matching/agreements/${agreement.id}/reservation`,
    { body: {}, key: "reserve" },
  );
  assert.equal(reserved.body.reservation.status, "requested");
  const outsider = (await call(base, "outsider", "/matching")).body.data
    .searchResults;
  assert.equal(outsider.length, 1);
  assert.equal(outsider[0].internal, undefined);
  assert.equal(
    (
      await call(
        base,
        "outsider",
        `/matching/agreements/${agreement.id}/reservation`,
        { body: {}, key: "bad-reserve" },
      )
    ).status,
    403,
  );
});
