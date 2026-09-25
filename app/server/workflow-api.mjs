import http from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";

export const TEST_TOKENS = {
  "construction-token": {
    userId: "user-construction",
    orgId: "org-construction",
    role: "construction",
  },
  "receiving-token": {
    userId: "user-receiving",
    orgId: "org-receiving",
    role: "receiving",
  },
  "driver-token": {
    userId: "user-driver",
    orgId: "org-carrier",
    role: "driver",
    driverId: "driver-01",
  },
  "driver-02-token": {
    userId: "user-driver-02",
    orgId: "org-carrier",
    role: "driver",
    driverId: "driver-02",
  },
  "outsider-token": {
    userId: "user-outsider",
    orgId: "org-outsider",
    role: "construction",
  },
};

const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
};
const readJson = async (req) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
};
const fail = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

export function openWorkflowDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`pragma foreign_keys=on; pragma journal_mode=wal;
    create table if not exists organizations(id text primary key, name text not null);
    create table if not exists users(id text primary key, organization_id text not null, display_name text not null, role text not null);
    create table if not exists organization_relationships(source_organization_id text not null, partner_organization_id text not null, relationship_type text not null, active integer not null default 1, primary key(source_organization_id,partner_organization_id,relationship_type));
    create table if not exists sites(id text primary key, organization_id text not null, name text not null);
    create table if not exists receiving_locations(id text primary key, organization_id text not null, name text not null);
    create table if not exists vehicles(id text primary key, organization_id text not null, name text not null, registration text not null);
    create table if not exists drivers(id text primary key, organization_id text not null, user_id text not null unique, display_name text not null);
    create table if not exists reservations(
      id text primary key, source_organization_id text not null, receiving_organization_id text not null,
      site_id text not null, receiving_location_id text not null, status text not null,
      planned_at text not null, soil_type text not null, planned_quantity real not null,
      unit text not null, version integer not null default 1, created_by text not null, created_at text not null, updated_at text not null);
    create table if not exists trips(
      id text primary key, reservation_id text not null, rotation_no integer not null, vehicle_id text, driver_id text,
      status text not null, version integer not null default 1, assigned_at text, completed_at text,
      unique(reservation_id, rotation_no));
    create table if not exists trip_events(
      id text primary key, trip_id text not null, event_type text not null, actor_user_id text not null,
      occurred_at text not null, operation_key text not null unique, payload text not null default '{}');
    create table if not exists receipts(
      id text primary key, trip_id text not null unique, actual_quantity real not null, unit text not null,
      status text not null, version integer not null default 1, confirmed_by text not null, confirmed_at text not null);
    create table if not exists receipt_corrections(
      id text primary key, receipt_id text not null, previous_quantity real not null, corrected_quantity real not null,
      reason text not null, corrected_by text not null, corrected_at text not null);
    create table if not exists attachments(
      id text primary key, reservation_id text, trip_id text, owner_organization_id text not null,
      storage_key text not null, file_name text not null, created_at text not null);
    create table if not exists operations(
      operation_key text primary key, actor_user_id text not null, status text not null,
      response_status integer, response_body text, created_at text not null);
    create table if not exists operation_fingerprints(operation_key text primary key references operations(operation_key), fingerprint text not null);
    create table if not exists audit_logs(
      id text primary key, actor_user_id text not null, action text not null, entity_type text not null,
      entity_id text not null, before_data text, after_data text, created_at text not null);
    create table if not exists match_cases(
      id text primary key, owner_organization_id text not null, owner_side text not null, status text not null,
      title text not null, region text not null, soil_type text not null, quantity real not null, unit text not null,
      period_start text not null, period_end text not null, public_data text not null, shared_data text not null,
      internal_data text not null, documents text not null default '[]', version integer not null default 1,
      created_by text not null, created_at text not null, updated_at text not null);
    create table if not exists consultations(
      id text primary key, source_case_id text not null, target_case_id text not null,
      source_organization_id text not null, target_organization_id text not null, status text not null,
      version integer not null default 1, created_by text not null, created_at text not null, updated_at text not null);
    create table if not exists consultation_offers(
      id text primary key, consultation_id text not null, offer_no integer not null, offered_by_organization_id text not null,
      terms_snapshot text not null, message text not null, created_at text not null, unique(consultation_id,offer_no));
    create table if not exists consultation_acceptances(
      consultation_id text not null, offer_no integer not null, organization_id text not null, accepted_by text not null,
      accepted_at text not null, primary key(consultation_id,offer_no,organization_id));
    create table if not exists match_agreements(
      id text primary key, consultation_id text not null unique, offer_no integer not null,
      source_case_snapshot text not null, target_case_snapshot text not null, terms_snapshot text not null,
      agreed_at text not null, version integer not null default 1);
    create table if not exists agreement_reservations(agreement_id text primary key, reservation_id text not null unique);
  `);
  const seed = db.prepare("insert or ignore into organizations values (?, ?)");
  [
    ["org-construction", "匿名施工会社"],
    ["org-receiving", "匿名受入会社"],
    ["org-carrier", "匿名運送会社"],
    ["org-outsider", "権限外会社"],
  ].forEach((r) => seed.run(...r));
  const user = db.prepare("insert or ignore into users values (?, ?, ?, ?)");
  Object.values(TEST_TOKENS).forEach((u) =>
    user.run(u.userId, u.orgId, `匿名${u.role}担当`, u.role),
  );
  db.prepare(
    "insert or ignore into organization_relationships values ('org-construction','org-receiving','direct_transport',1)",
  ).run();
  db.prepare(
    "insert or ignore into organization_relationships values ('org-construction','org-carrier','carrier',1)",
  ).run();
  db.prepare(
    "insert or ignore into sites values ('site-01','org-construction','匿名搬出現場 A')",
  ).run();
  db.prepare(
    "insert or ignore into receiving_locations values ('location-01','org-receiving','匿名受入場所 A')",
  ).run();
  db.prepare(
    "insert or ignore into vehicles values ('vehicle-01','org-carrier','匿名ダンプ 01','TEST-0001')",
  ).run();
  db.prepare(
    "insert or ignore into vehicles values ('vehicle-02','org-carrier','匿名ダンプ 02','TEST-0002')",
  ).run();
  db.prepare(
    "insert or ignore into drivers values ('driver-01','org-carrier','user-driver','匿名ドライバー A')",
  ).run();
  db.prepare(
    "insert or ignore into drivers values ('driver-02','org-carrier','user-driver-02','匿名ドライバー B')",
  ).run();
  return db;
}

const row = (db, sql, ...args) => db.prepare(sql).get(...args);
const rows = (db, sql, ...args) => db.prepare(sql).all(...args);
const now = () => new Date().toISOString();
const version = (req) => {
  const value = Number(req.headers["if-match"]);
  if (!Number.isInteger(value))
    throw fail(428, "VERSION_REQUIRED", "If-Matchに現在のversionが必要です。");
  return value;
};
const auth = (req) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const actor = TEST_TOKENS[token];
  if (!actor) throw fail(401, "UNAUTHENTICATED", "認証が必要です。");
  return actor;
};
const accessible = (actor, reservation, trip = null) =>
  actor.orgId === reservation.source_organization_id ||
  actor.orgId === reservation.receiving_organization_id ||
  (actor.role === "driver" && trip?.driver_id === actor.driverId);
const snapshot = (db, actor) => {
  const reservations = rows(
    db,
    "select * from reservations order by created_at desc",
  );
  return reservations
    .filter((r) => {
      const assigned = rows(
        db,
        "select * from trips where reservation_id=? order by rotation_no",
        r.id,
      );
      return actor.role === "driver"
        ? assigned.some((trip) => trip.driver_id === actor.driverId)
        : accessible(actor, r, assigned[0]);
    })
    .map((reservation) => {
      const allTrips = rows(
        db,
        "select * from trips where reservation_id=? order by rotation_no",
        reservation.id,
      );
      const trips =
        actor.role === "driver"
          ? allTrips.filter((item) => item.driver_id === actor.driverId)
          : allTrips;
      const trip = trips[0] || null;
      return {
        reservation,
        trip,
        trips,
        events: trips.flatMap((item) =>
          rows(
            db,
            "select * from trip_events where trip_id=? order by occurred_at",
            item.id,
          ),
        ),
        receipt: trip
          ? row(db, "select * from receipts where trip_id=?", trip.id) || null
          : null,
      };
    });
};
const audit = (db, actor, action, type, id, before, after) =>
  db
    .prepare("insert into audit_logs values (?,?,?,?,?,?,?,?)")
    .run(
      randomUUID(),
      actor.userId,
      action,
      type,
      id,
      before && JSON.stringify(before),
      after && JSON.stringify(after),
      now(),
    );
const parsed = (value, fallback = {}) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const caseSnapshot = (value) => ({
  id: value.id,
  ownerSide: value.owner_side,
  title: value.title,
  region: value.region,
  soilType: value.soil_type,
  quantity: value.quantity,
  unit: value.unit,
  periodStart: value.period_start,
  periodEnd: value.period_end,
  public: parsed(value.public_data),
  documents: parsed(value.documents, []),
  version: value.version,
});
const agreedCaseSnapshot = (value) => ({
  ...caseSnapshot(value),
  shared: parsed(value.shared_data),
});
const consultationAccess = (actor, value) =>
  value &&
  [value.source_organization_id, value.target_organization_id].includes(
    actor.orgId,
  );
const serializeCase = (db, actor, value) => {
  const own = value.owner_organization_id === actor.orgId;
  const consulted =
    rows(
      db,
      "select * from consultations where (source_case_id=? or target_case_id=?) and (source_organization_id=? or target_organization_id=?)",
      value.id,
      value.id,
      actor.orgId,
      actor.orgId,
    ).length > 0;
  return {
    ...caseSnapshot(value),
    status: value.status,
    ownerOrganizationId: value.owner_organization_id,
    ...(own
      ? {
          shared: parsed(value.shared_data),
          internal: parsed(value.internal_data),
        }
      : consulted
        ? { shared: parsed(value.shared_data) }
        : {}),
  };
};
const matchingSnapshot = (db, actor, searchParams) => {
  if (!["construction", "receiving"].includes(actor.role))
    throw fail(403, "ROLE_FORBIDDEN", "施工側または受入側だけが利用できます。");
  const own = rows(
    db,
    "select * from match_cases where owner_organization_id=? order by updated_at desc",
    actor.orgId,
  );
  const opposite = actor.role === "construction" ? "receiving" : "construction";
  const region = searchParams.get("region") || "",
    soil = searchParams.get("soil") || "",
    quantity = Number(searchParams.get("quantity") || 0),
    start = searchParams.get("start") || "",
    end = searchParams.get("end") || "";
  const found = rows(
    db,
    "select * from match_cases where owner_side=? and status='published' and owner_organization_id<>? order by updated_at desc",
    opposite,
    actor.orgId,
  ).filter(
    (c) =>
      (!region || c.region.includes(region)) &&
      (!soil || c.soil_type.includes(soil)) &&
      (!quantity || c.quantity >= quantity) &&
      (!start || c.period_end >= start) &&
      (!end || c.period_start <= end),
  );
  const consultations = rows(
    db,
    "select * from consultations where source_organization_id=? or target_organization_id=? order by updated_at desc",
    actor.orgId,
    actor.orgId,
  ).map((c) => ({
    ...c,
    offers: rows(
      db,
      "select * from consultation_offers where consultation_id=? order by offer_no",
      c.id,
    ).map((o) => ({ ...o, terms: parsed(o.terms_snapshot) })),
    acceptances: rows(
      db,
      "select * from consultation_acceptances where consultation_id=?",
      c.id,
    ),
  }));
  const agreements = rows(
    db,
    "select a.* from match_agreements a join consultations c on c.id=a.consultation_id where c.source_organization_id=? or c.target_organization_id=? order by a.agreed_at desc",
    actor.orgId,
    actor.orgId,
  ).map((a) => ({
    ...a,
    sourceCase: parsed(a.source_case_snapshot),
    targetCase: parsed(a.target_case_snapshot),
    terms: parsed(a.terms_snapshot),
    reservationId:
      row(
        db,
        "select reservation_id from agreement_reservations where agreement_id=?",
        a.id,
      )?.reservation_id || null,
  }));
  return {
    ownCases: own.map((c) => serializeCase(db, actor, c)),
    searchResults: found.map((c) => serializeCase(db, actor, c)),
    consultations,
    agreements,
  };
};

const canonicalPayload = value => Array.isArray(value) ? value.map(canonicalPayload) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalPayload(value[key])])) : value;
function mutate(db, req, actor, handler) {
  const fingerprint = createHash("sha256").update(JSON.stringify([req.method, req.url, req.headers["if-match"] || null, canonicalPayload(req.workflowBody)])).digest("hex");
  const key = req.headers["idempotency-key"];
  if (!key)
    throw fail(428, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Keyが必要です。");
  const existing = row(
    db,
    "select * from operations where operation_key=?",
    key,
  );
  if (existing) {
    if (existing.actor_user_id !== actor.userId)
      throw fail(
        403,
        "OPERATION_FORBIDDEN",
        "別ユーザーの処理結果は参照できません。",
      );
    const recorded = row(db, "select fingerprint from operation_fingerprints where operation_key=?", key);
    if (!recorded || recorded.fingerprint !== fingerprint) throw fail(409, "IDEMPOTENCY_CONFLICT", "同じ操作IDの内容が一致しません。元の処理結果を照会してください。");
    return {
      status: existing.response_status,
      body: JSON.parse(existing.response_body),
      replayed: true,
    };
  }
  db.exec("begin immediate");
  try {
    db.prepare(
      "insert into operations values (?,?, 'processing', null, null, ?)",
    ).run(key, actor.userId, now());
    db.prepare("insert into operation_fingerprints values (?,?)").run(key, fingerprint);
    const result = handler(key);
    db.prepare(
      "update operations set status='completed',response_status=?,response_body=? where operation_key=?",
    ).run(result.status, JSON.stringify(result.body), key);
    db.exec("commit");
    return result;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

export function createWorkflowServer({ dbPath, port = 4180 } = {}) {
  const db = openWorkflowDatabase(dbPath);
  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith("/api/"))
      return json(res, 404, { code: "NOT_FOUND" });
    try {
      const actor = auth(req);
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/workflow")
        return json(res, 200, { data: snapshot(db, actor), actor });
      if (req.method === "GET" && url.pathname === "/api/matching")
        return json(res, 200, {
          data: matchingSnapshot(db, actor, url.searchParams),
          actor,
        });
      const operationMatch = url.pathname.match(/^\/api\/operations\/([^/]+)$/);
      if (req.method === "GET" && operationMatch) {
        const operation = row(
          db,
          "select * from operations where operation_key=?",
          decodeURIComponent(operationMatch[1]),
        );
        if (!operation || operation.actor_user_id !== actor.userId)
          throw fail(404, "OPERATION_NOT_FOUND", "処理結果が見つかりません。");
        return json(res, 200, {
          operationKey: operation.operation_key,
          status: operation.status,
          result: operation.response_body
            ? JSON.parse(operation.response_body)
            : null,
        });
      }
      const body = await readJson(req);
      req.workflowBody = body;
      let result;
      if (req.method === "POST" && url.pathname === "/api/matching/cases")
        result = mutate(db, req, actor, () => {
          if (!["construction", "receiving"].includes(actor.role))
            throw fail(403, "ROLE_FORBIDDEN", "案件を登録できません。");
          if (body.ownerSide !== actor.role)
            throw fail(
              403,
              "SCOPE_FORBIDDEN",
              "現在の事業モードと案件区分が一致しません。",
            );
          if (
            !body.title ||
            !body.region ||
            !body.soilType ||
            Number(body.quantity) <= 0 ||
            !body.periodStart ||
            !body.periodEnd
          )
            throw fail(422, "INVALID_CASE", "必須項目を確認してください。");
          if (body.periodStart > body.periodEnd)
            throw fail(
              422,
              "INVALID_PERIOD",
              "期間の開始と終了を確認してください。",
            );
          const id = randomUUID(),
            at = now();
          db.prepare(
            "insert into match_cases(id,owner_organization_id,owner_side,status,title,region,soil_type,quantity,unit,period_start,period_end,public_data,shared_data,internal_data,documents,version,created_by,created_at,updated_at) values (?,?,?,'draft',?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)",
          ).run(
            id,
            actor.orgId,
            actor.role,
            body.title,
            body.region,
            body.soilType,
            Number(body.quantity),
            body.unit || "m3",
            body.periodStart,
            body.periodEnd,
            JSON.stringify(body.public || {}),
            JSON.stringify(body.shared || {}),
            JSON.stringify(body.internal || {}),
            JSON.stringify(body.documents || []),
            actor.userId,
            at,
            at,
          );
          const created = row(db, "select * from match_cases where id=?", id);
          audit(db, actor, "create", "match_case", id, null, created);
          return {
            status: 201,
            body: { case: serializeCase(db, actor, created) },
          };
        });
      else {
        const caseAction = url.pathname.match(
          /^\/api\/matching\/cases\/([^/]+)\/(publish|close|edit)$/,
        );
        const consultCreate = url.pathname === "/api/matching/consultations";
        const offer = url.pathname.match(
          /^\/api\/matching\/consultations\/([^/]+)\/offers$/,
        );
        const accept = url.pathname.match(
          /^\/api\/matching\/consultations\/([^/]+)\/accept$/,
        );
        const reserve = url.pathname.match(
          /^\/api\/matching\/agreements\/([^/]+)\/reservation$/,
        );
        if (req.method === "POST" && caseAction)
          result = mutate(db, req, actor, () => {
            const current = row(
              db,
              "select * from match_cases where id=?",
              caseAction[1],
            );
            if (!current) throw fail(404, "NOT_FOUND", "案件がありません。");
            if (current.owner_organization_id !== actor.orgId)
              throw fail(403, "SCOPE_FORBIDDEN", "自社案件だけ変更できます。");
            const expected = version(req);
            if (current.version !== expected)
              throw fail(
                409,
                "VERSION_CONFLICT",
                "案件が更新されています。再取得してください。",
              );
            let status = current.status;
            if (caseAction[2] === "publish") {
              if (!["draft", "closed"].includes(status))
                throw fail(
                  409,
                  "INVALID_STATE",
                  "下書きまたは公開終了案件だけ公開できます。",
                );
              status = "published";
            }
            if (caseAction[2] === "close") {
              if (status !== "published")
                throw fail(
                  409,
                  "INVALID_STATE",
                  "公開中案件だけ公開終了できます。",
                );
              status = "closed";
            }
            const title =
                caseAction[2] === "edit"
                  ? body.title || current.title
                  : current.title,
              quantity =
                caseAction[2] === "edit"
                  ? Number(body.quantity || current.quantity)
                  : current.quantity;
            db.prepare(
              "update match_cases set status=?,title=?,quantity=?,version=version+1,updated_at=? where id=? and version=?",
            ).run(status, title, quantity, now(), current.id, expected);
            const updated = row(
              db,
              "select * from match_cases where id=?",
              current.id,
            );
            audit(
              db,
              actor,
              caseAction[2],
              "match_case",
              current.id,
              current,
              updated,
            );
            return {
              status: 200,
              body: { case: serializeCase(db, actor, updated) },
            };
          });
        else if (req.method === "POST" && consultCreate)
          result = mutate(db, req, actor, () => {
            const source = row(
                db,
                "select * from match_cases where id=?",
                body.sourceCaseId,
              ),
              target = row(
                db,
                "select * from match_cases where id=?",
                body.targetCaseId,
              );
            if (
              !source ||
              !target ||
              source.owner_organization_id !== actor.orgId ||
              target.owner_organization_id === actor.orgId ||
              source.status !== "published" ||
              target.status !== "published" ||
              source.owner_side === target.owner_side
            )
              throw fail(
                403,
                "INVALID_CONSULTATION",
                "公開中の自社案件と相手案件を指定してください。",
              );
            const id = randomUUID(),
              at = now();
            db.prepare(
              "insert into consultations values (?,?,?,?,?,'consulting',1,?,?,?)",
            ).run(
              id,
              source.id,
              target.id,
              source.owner_organization_id,
              target.owner_organization_id,
              actor.userId,
              at,
              at,
            );
            const terms = {
              quantity: Math.min(source.quantity, target.quantity),
              unit: source.unit,
              periodStart:
                source.period_start > target.period_start
                  ? source.period_start
                  : target.period_start,
              periodEnd:
                source.period_end < target.period_end
                  ? source.period_end
                  : target.period_end,
              soilType: source.soil_type,
            };
            db.prepare(
              "insert into consultation_offers values (?,?,1,?,?,?,?)",
            ).run(
              randomUUID(),
              id,
              actor.orgId,
              JSON.stringify(terms),
              body.message || "事前相談を開始",
              at,
            );
            const created = row(
              db,
              "select * from consultations where id=?",
              id,
            );
            audit(db, actor, "create", "consultation", id, null, created);
            return { status: 201, body: { consultation: created } };
          });
        else if (req.method === "POST" && offer)
          result = mutate(db, req, actor, () => {
            const c = row(
              db,
              "select * from consultations where id=?",
              offer[1],
            );
            if (!consultationAccess(actor, c))
              throw fail(403, "SCOPE_FORBIDDEN", "この相談を更新できません。");
            const expected = version(req);
            if (c.version !== expected)
              throw fail(
                409,
                "VERSION_CONFLICT",
                "相談が更新されています。再取得してください。",
              );
            if (c.status !== "consulting")
              throw fail(
                409,
                "INVALID_STATE",
                "条件調整中の相談ではありません。",
              );
            const offerNo = row(
              db,
              "select coalesce(max(offer_no),0)+1 as value from consultation_offers where consultation_id=?",
              c.id,
            ).value;
            const at = now();
            db.prepare(
              "insert into consultation_offers values (?,?,?,?,?,?,?)",
            ).run(
              randomUUID(),
              c.id,
              offerNo,
              actor.orgId,
              JSON.stringify(body.terms || {}),
              body.message || "条件を提示",
              at,
            );
            db.prepare(
              "delete from consultation_acceptances where consultation_id=?",
            ).run(c.id);
            db.prepare(
              "update consultations set version=version+1,updated_at=? where id=? and version=?",
            ).run(at, c.id, expected);
            return {
              status: 201,
              body: {
                consultation: row(
                  db,
                  "select * from consultations where id=?",
                  c.id,
                ),
                offerNo,
              },
            };
          });
        else if (req.method === "POST" && accept)
          result = mutate(db, req, actor, () => {
            const c = row(
              db,
              "select * from consultations where id=?",
              accept[1],
            );
            if (!consultationAccess(actor, c))
              throw fail(403, "SCOPE_FORBIDDEN", "この相談を承認できません。");
            const expected = version(req);
            if (c.version !== expected)
              throw fail(
                409,
                "VERSION_CONFLICT",
                "相談が更新されています。再取得してください。",
              );
            if (c.status !== "consulting")
              throw fail(
                409,
                "INVALID_STATE",
                "条件調整中の相談ではありません。",
              );
            const latest = row(
              db,
              "select * from consultation_offers where consultation_id=? order by offer_no desc limit 1",
              c.id,
            );
            if (!latest)
              throw fail(409, "NO_OFFER", "合意対象の条件がありません。");
            db.prepare(
              "insert or ignore into consultation_acceptances values (?,?,?,?,?)",
            ).run(c.id, latest.offer_no, actor.orgId, actor.userId, now());
            const count = row(
              db,
              "select count(*) as value from consultation_acceptances where consultation_id=? and offer_no=?",
              c.id,
              latest.offer_no,
            ).value;
            let agreement = null;
            if (count === 2) {
              const source = row(
                  db,
                  "select * from match_cases where id=?",
                  c.source_case_id,
                ),
                target = row(
                  db,
                  "select * from match_cases where id=?",
                  c.target_case_id,
                ),
                id = randomUUID(),
                at = now();
              db.prepare(
                "insert into match_agreements values (?,?,?,?,?,?,?,1)",
              ).run(
                id,
                c.id,
                latest.offer_no,
                JSON.stringify(agreedCaseSnapshot(source)),
                JSON.stringify(agreedCaseSnapshot(target)),
                latest.terms_snapshot,
                at,
              );
              db.prepare(
                "update consultations set status='agreed',version=version+1,updated_at=? where id=?",
              ).run(at, c.id);
              agreement = row(
                db,
                "select * from match_agreements where id=?",
                id,
              );
            }
            return { status: 200, body: { accepted: true, agreement } };
          });
        else if (req.method === "POST" && reserve)
          result = mutate(db, req, actor, () => {
            const a = row(
                db,
                "select * from match_agreements where id=?",
                reserve[1],
              ),
              c =
                a &&
                row(
                  db,
                  "select * from consultations where id=?",
                  a.consultation_id,
                );
            if (!a || !c) throw fail(404, "NOT_FOUND", "合意がありません。");
            const source = row(
                db,
                "select * from match_cases where id=?",
                c.source_case_id,
              ),
              target = row(
                db,
                "select * from match_cases where id=?",
                c.target_case_id,
              );
            const construction =
                source.owner_side === "construction" ? source : target,
              receiving = source.owner_side === "receiving" ? source : target;
            if (
              actor.role !== "construction" ||
              construction.owner_organization_id !== actor.orgId
            )
              throw fail(
                403,
                "SCOPE_FORBIDDEN",
                "施工側だけが合意から予約申請を作成できます。",
              );
            const existing = row(
              db,
              "select reservation_id from agreement_reservations where agreement_id=?",
              a.id,
            );
            if (existing)
              return {
                status: 200,
                body: {
                  reservation: row(
                    db,
                    "select * from reservations where id=?",
                    existing.reservation_id,
                  ),
                },
              };
            const terms = parsed(a.terms_snapshot),
              id = randomUUID(),
              at = now();
            db.prepare(
              "insert into reservations values (?,?,?,?,?,'requested',?,?,?,?,1,?,?,?)",
            ).run(
              id,
              construction.owner_organization_id,
              receiving.owner_organization_id,
              "site-01",
              "location-01",
              `${terms.periodStart}T00:00:00.000Z`,
              terms.soilType,
              terms.quantity,
              terms.unit || "m3",
              actor.userId,
              at,
              at,
            );
            db.prepare("insert into agreement_reservations values (?,?)").run(
              a.id,
              id,
            );
            const reservation = row(
              db,
              "select * from reservations where id=?",
              id,
            );
            audit(
              db,
              actor,
              "create_from_agreement",
              "reservation",
              id,
              null,
              reservation,
            );
            return { status: 201, body: { reservation } };
          });
        else if (req.method === "POST" && url.pathname === "/api/reservations")
          result = mutate(db, req, actor, () => {
            if (actor.role !== "construction")
              throw fail(
                403,
                "ROLE_FORBIDDEN",
                "施工側だけが予約を作成できます。",
              );
            const site = row(db, "select * from sites where id=?", body.siteId);
            const location = row(
              db,
              "select * from receiving_locations where id=?",
              body.receivingLocationId,
            );
            const partner =
              location &&
              row(
                db,
                "select 1 as allowed from organization_relationships where source_organization_id=? and partner_organization_id=? and relationship_type='direct_transport' and active=1",
                actor.orgId,
                location.organization_id,
              );
            if (
              !site ||
              site.organization_id !== actor.orgId ||
              !location ||
              !partner
            )
              throw fail(
                403,
                "SCOPE_FORBIDDEN",
                "許可された自社現場と取引可能な受入場所を指定してください。",
              );
            const id = randomUUID(),
              at = now();
            db.prepare(
              "insert into reservations values (?,?,?,?,?,'requested',?,?,?,?,1,?,?,?)",
            ).run(
              id,
              actor.orgId,
              location.organization_id,
              site.id,
              location.id,
              body.plannedAt,
              body.soilType,
              body.plannedQuantity,
              body.unit || "m3",
              actor.userId,
              at,
              at,
            );
            const created = row(
              db,
              "select * from reservations where id=?",
              id,
            );
            audit(db, actor, "create", "reservation", id, null, created);
            return { status: 201, body: { reservation: created } };
          });
        else {
          const confirm = url.pathname.match(
            /^\/api\/reservations\/([^/]+)\/confirm$/,
          );
          const assign = url.pathname.match(
            /^\/api\/reservations\/([^/]+)\/assign$/,
          );
          const reservationAction = url.pathname.match(
            /^\/api\/reservations\/([^/]+)\/(change|cancel|unavailable)$/,
          );
          const event = url.pathname.match(/^\/api\/trips\/([^/]+)\/events$/);
          const reassign = url.pathname.match(
            /^\/api\/trips\/([^/]+)\/reassign$/,
          );
          const delay = url.pathname.match(/^\/api\/trips\/([^/]+)\/delay$/);
          const receipt = url.pathname.match(
            /^\/api\/trips\/([^/]+)\/receipt\/confirm$/,
          );
          const correction = url.pathname.match(
            /^\/api\/receipts\/([^/]+)\/correct$/,
          );
          if (req.method === "POST" && confirm)
            result = mutate(db, req, actor, () => {
              const r = row(
                db,
                "select * from reservations where id=?",
                confirm[1],
              );
              if (!r) throw fail(404, "NOT_FOUND", "予約がありません。");
              if (
                actor.role !== "receiving" ||
                r.receiving_organization_id !== actor.orgId
              )
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "この受入場所の予約を確定できません。",
                );
              const expected = version(req);
              if (r.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "予約が更新されています。再取得してください。",
                );
              if (r.status !== "requested")
                throw fail(
                  409,
                  "INVALID_STATE",
                  "申請中の予約だけ確定できます。",
                );
              db.prepare(
                "update reservations set status='confirmed',version=version+1,updated_at=? where id=? and version=?",
              ).run(now(), r.id, expected);
              const updated = row(
                db,
                "select * from reservations where id=?",
                r.id,
              );
              audit(db, actor, "confirm", "reservation", r.id, r, updated);
              return { status: 200, body: { reservation: updated } };
            });
          else if (req.method === "POST" && assign)
            result = mutate(db, req, actor, () => {
              const r = row(
                db,
                "select * from reservations where id=?",
                assign[1],
              );
              if (!r) throw fail(404, "NOT_FOUND", "予約がありません。");
              if (
                actor.role !== "construction" ||
                r.source_organization_id !== actor.orgId
              )
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "この予約を配車できません。",
                );
              if (r.status !== "confirmed")
                throw fail(
                  409,
                  "INVALID_STATE",
                  "予約確定後に配車してください。",
                );
              const expected = version(req);
              if (r.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "予約が更新されています。再取得してください。",
                );
              const vehicle = row(
                  db,
                  "select * from vehicles where id=?",
                  body.vehicleId,
                ),
                driver = row(
                  db,
                  "select * from drivers where id=?",
                  body.driverId,
                );
              const carrier =
                vehicle &&
                row(
                  db,
                  "select 1 as allowed from organization_relationships where source_organization_id=? and partner_organization_id=? and relationship_type='carrier' and active=1",
                  actor.orgId,
                  vehicle.organization_id,
                );
              if (
                !vehicle ||
                !driver ||
                vehicle.organization_id !== driver.organization_id ||
                !carrier
              )
                throw fail(
                  422,
                  "INVALID_ASSIGNMENT",
                  "許可された運送会社の車両・ドライバーを指定してください。",
                );
              const rotationNo = Number(body.rotationNo || 1);
              if (!Number.isInteger(rotationNo) || rotationNo < 1)
                throw fail(
                  422,
                  "INVALID_ROTATION",
                  "便番号は1以上の整数で指定してください。",
                );
              const id = randomUUID();
              try {
                db.prepare(
                  "insert into trips values (?,?,?,?,?,'assigned',1,?,null)",
                ).run(id, r.id, rotationNo, vehicle.id, driver.id, now());
              } catch (error) {
                if (String(error.message).includes("UNIQUE"))
                  throw fail(
                    409,
                    "ROTATION_EXISTS",
                    "同じ便番号は登録済みです。再取得してください。",
                  );
                throw error;
              }
              db.prepare(
                "update reservations set version=version+1,updated_at=? where id=? and version=?",
              ).run(now(), r.id, expected);
              const trip = row(db, "select * from trips where id=?", id);
              audit(db, actor, "assign", "trip", id, null, trip);
              return {
                status: 201,
                body: {
                  trip,
                  reservation: row(
                    db,
                    "select * from reservations where id=?",
                    r.id,
                  ),
                },
              };
            });
          else if (req.method === "POST" && reservationAction)
            result = mutate(db, req, actor, () => {
              const r = row(
                db,
                "select * from reservations where id=?",
                reservationAction[1],
              );
              if (!r) throw fail(404, "NOT_FOUND", "予約がありません。");
              const action = reservationAction[2];
              if (
                action === "unavailable" &&
                (actor.role !== "receiving" ||
                  r.receiving_organization_id !== actor.orgId)
              )
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "この受入場所を受入不可にできません。",
                );
              if (
                action !== "unavailable" &&
                (actor.role !== "construction" ||
                  r.source_organization_id !== actor.orgId)
              )
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "この予約を変更できません。",
                );
              const expected = version(req);
              if (r.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "予約が更新されています。再取得してください。",
                );
              const trips = rows(
                db,
                "select * from trips where reservation_id=?",
                r.id,
              );
              const started = trips.some((trip) => trip.status !== "assigned");
              if (action === "unavailable") {
                if (!body.reason)
                  throw fail(422, "REASON_REQUIRED", "理由が必要です。");
                if (["cancelled", "rejected"].includes(r.status))
                  throw fail(
                    409,
                    "INVALID_STATE",
                    "予約は既に終了しています。",
                  );
                db.prepare(
                  "update reservations set status='rejected',version=version+1,updated_at=? where id=? and version=?",
                ).run(now(), r.id, expected);
              } else {
                if (!body.reason)
                  throw fail(422, "REASON_REQUIRED", "理由が必要です。");
                if (started)
                  throw fail(
                    409,
                    "TRIP_ALREADY_STARTED",
                    "運行開始後は予約を変更・取消できません。",
                  );
                if (action === "cancel")
                  db.prepare(
                    "update reservations set status='cancelled',version=version+1,updated_at=? where id=? and version=?",
                  ).run(now(), r.id, expected);
                else {
                  const quantity = Number(
                    body.plannedQuantity ?? r.planned_quantity,
                  );
                  if (quantity <= 0)
                    throw fail(
                      422,
                      "INVALID_QUANTITY",
                      "予定数量を確認してください。",
                    );
                  db.prepare(
                    "update reservations set planned_at=?,planned_quantity=?,status='requested',version=version+1,updated_at=? where id=? and version=?",
                  ).run(
                    body.plannedAt || r.planned_at,
                    quantity,
                    now(),
                    r.id,
                    expected,
                  );
                }
              }
              const updated = row(
                db,
                "select * from reservations where id=?",
                r.id,
              );
              audit(db, actor, action, "reservation", r.id, r, {
                ...updated,
                reason: body.reason,
              });
              return { status: 200, body: { reservation: updated } };
            });
          else if (req.method === "POST" && reassign)
            result = mutate(db, req, actor, () => {
              const t = row(db, "select * from trips where id=?", reassign[1]);
              const r =
                t &&
                row(
                  db,
                  "select * from reservations where id=?",
                  t.reservation_id,
                );
              if (!t || !r) throw fail(404, "NOT_FOUND", "運行がありません。");
              if (
                actor.role !== "construction" ||
                r.source_organization_id !== actor.orgId
              )
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "この配車を変更できません。",
                );
              const expected = version(req);
              if (t.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "運行を再取得してください。",
                );
              if (t.status !== "assigned")
                throw fail(
                  409,
                  "TRIP_ALREADY_STARTED",
                  "運行開始後は配車変更できません。",
                );
              const vehicle = row(
                  db,
                  "select * from vehicles where id=?",
                  body.vehicleId,
                ),
                driver = row(
                  db,
                  "select * from drivers where id=?",
                  body.driverId,
                );
              const carrier =
                vehicle &&
                row(
                  db,
                  "select 1 as allowed from organization_relationships where source_organization_id=? and partner_organization_id=? and relationship_type='carrier' and active=1",
                  actor.orgId,
                  vehicle.organization_id,
                );
              if (
                !vehicle ||
                !driver ||
                vehicle.organization_id !== driver.organization_id ||
                !carrier
              )
                throw fail(
                  422,
                  "INVALID_ASSIGNMENT",
                  "許可された車両・ドライバーを指定してください。",
                );
              db.prepare(
                "update trips set vehicle_id=?,driver_id=?,version=version+1,assigned_at=? where id=? and version=?",
              ).run(vehicle.id, driver.id, now(), t.id, expected);
              const updated = row(db, "select * from trips where id=?", t.id);
              audit(db, actor, "reassign", "trip", t.id, t, updated);
              return { status: 200, body: { trip: updated } };
            });
          else if (req.method === "POST" && delay)
            result = mutate(db, req, actor, (operationKey) => {
              const t = row(db, "select * from trips where id=?", delay[1]);
              const r =
                t &&
                row(
                  db,
                  "select * from reservations where id=?",
                  t.reservation_id,
                );
              if (!t || !r) throw fail(404, "NOT_FOUND", "運行がありません。");
              if (actor.role !== "driver" || t.driver_id !== actor.driverId)
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "自分に割り当てられた運行だけ報告できます。",
                );
              const expected = version(req);
              if (t.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "運行を再取得してください。",
                );
              if (r.status !== "confirmed" || t.status === "unloaded")
                throw fail(
                  409,
                  "INVALID_STATE",
                  "この運行は遅延報告できません。",
                );
              if (!body.reason || !body.estimatedArrivalAt)
                throw fail(
                  422,
                  "DELAY_DETAILS_REQUIRED",
                  "遅延理由と到着見込時刻が必要です。",
                );
              const id = randomUUID(),
                at = now();
              db.prepare("insert into trip_events values (?,?,?,?,?,?,?)").run(
                id,
                t.id,
                "delayed",
                actor.userId,
                at,
                operationKey,
                JSON.stringify({
                  reason: body.reason,
                  estimatedArrivalAt: body.estimatedArrivalAt,
                }),
              );
              db.prepare(
                "update trips set version=version+1 where id=? and version=?",
              ).run(t.id, expected);
              const updated = row(db, "select * from trips where id=?", t.id);
              audit(db, actor, "delay", "trip", t.id, t, updated);
              return {
                status: 201,
                body: {
                  trip: updated,
                  event: row(db, "select * from trip_events where id=?", id),
                },
              };
            });
          else if (req.method === "POST" && event)
            result = mutate(db, req, actor, (key) => {
              const t = row(db, "select * from trips where id=?", event[1]),
                r =
                  t &&
                  row(
                    db,
                    "select * from reservations where id=?",
                    t.reservation_id,
                  );
              if (!t || !r) throw fail(404, "NOT_FOUND", "運行がありません。");
              if (actor.role !== "driver" || t.driver_id !== actor.driverId)
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "自分に割り当てられた運行だけ報告できます。",
                );
              if (r.status !== "confirmed")
                throw fail(
                  409,
                  "RESERVATION_NOT_ACTIVE",
                  "取消・受入不可の予約は運行報告できません。",
                );
              const expected = version(req);
              if (t.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "運行が更新されています。再取得してください。",
                );
              const order = {
                assigned: "arrived",
                arrived: "departed",
                departed: "unloaded",
              };
              if (order[t.status] !== body.eventType)
                throw fail(
                  409,
                  "INVALID_STATE",
                  "状態報告の順序が正しくありません。",
                );
              const id = randomUUID(),
                at = now();
              db.prepare("insert into trip_events values (?,?,?,?,?,?,?)").run(
                id,
                t.id,
                body.eventType,
                actor.userId,
                at,
                key,
                JSON.stringify(body.payload || {}),
              );
              db.prepare(
                "update trips set status=?,version=version+1,completed_at=? where id=? and version=?",
              ).run(
                body.eventType,
                body.eventType === "unloaded" ? at : null,
                t.id,
                expected,
              );
              const updated = row(db, "select * from trips where id=?", t.id);
              audit(db, actor, "report", "trip", t.id, t, updated);
              return {
                status: 201,
                body: {
                  trip: updated,
                  event: row(db, "select * from trip_events where id=?", id),
                },
              };
            });
          else if (req.method === "POST" && receipt)
            result = mutate(db, req, actor, () => {
              const t = row(db, "select * from trips where id=?", receipt[1]),
                r =
                  t &&
                  row(
                    db,
                    "select * from reservations where id=?",
                    t.reservation_id,
                  );
              if (!t || !r) throw fail(404, "NOT_FOUND", "運行がありません。");
              if (
                actor.role !== "receiving" ||
                r.receiving_organization_id !== actor.orgId
              )
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "この受入実績を確定できません。",
                );
              if (t.status !== "unloaded")
                throw fail(
                  409,
                  "INVALID_STATE",
                  "荷下ろし完了後に実績確定してください。",
                );
              const expected = version(req);
              if (t.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "運行が更新されています。再取得してください。",
                );
              if (Number(body.actualQuantity) <= 0)
                throw fail(
                  422,
                  "INVALID_QUANTITY",
                  "実績数量を確認してください。",
                );
              const id = randomUUID(),
                at = now();
              db.prepare(
                "insert into receipts values (?,?,?,?,'confirmed',1,?,?)",
              ).run(
                id,
                t.id,
                Number(body.actualQuantity),
                body.unit || r.unit,
                actor.userId,
                at,
              );
              const receiptRow = row(
                db,
                "select * from receipts where id=?",
                id,
              );
              audit(db, actor, "confirm", "receipt", id, null, receiptRow);
              return { status: 201, body: { receipt: receiptRow } };
            });
          else if (req.method === "POST" && correction)
            result = mutate(db, req, actor, () => {
              const receiptRow = row(
                db,
                "select * from receipts where id=?",
                correction[1],
              );
              const t =
                receiptRow &&
                row(db, "select * from trips where id=?", receiptRow.trip_id);
              const r =
                t &&
                row(
                  db,
                  "select * from reservations where id=?",
                  t.reservation_id,
                );
              if (!receiptRow || !t || !r)
                throw fail(404, "NOT_FOUND", "受入実績がありません。");
              if (
                actor.role !== "receiving" ||
                r.receiving_organization_id !== actor.orgId
              )
                throw fail(
                  403,
                  "SCOPE_FORBIDDEN",
                  "この受入実績を訂正できません。",
                );
              const expected = version(req);
              if (receiptRow.version !== expected)
                throw fail(
                  409,
                  "VERSION_CONFLICT",
                  "受入実績を再取得してください。",
                );
              const quantity = Number(body.actualQuantity);
              if (quantity <= 0)
                throw fail(
                  422,
                  "INVALID_QUANTITY",
                  "訂正後の数量を確認してください。",
                );
              if (!body.reason)
                throw fail(422, "REASON_REQUIRED", "訂正理由が必要です。");
              const id = randomUUID(),
                at = now();
              db.prepare(
                "insert into receipt_corrections values (?,?,?,?,?,?,?)",
              ).run(
                id,
                receiptRow.id,
                receiptRow.actual_quantity,
                quantity,
                body.reason,
                actor.userId,
                at,
              );
              db.prepare(
                "update receipts set actual_quantity=?,status='corrected',version=version+1 where id=? and version=?",
              ).run(quantity, receiptRow.id, expected);
              const updated = row(
                db,
                "select * from receipts where id=?",
                receiptRow.id,
              );
              audit(
                db,
                actor,
                "correct",
                "receipt",
                receiptRow.id,
                receiptRow,
                updated,
              );
              return {
                status: 200,
                body: {
                  receipt: updated,
                  correction: row(
                    db,
                    "select * from receipt_corrections where id=?",
                    id,
                  ),
                },
              };
            });
          else throw fail(404, "NOT_FOUND", "APIがありません。");
        }
      }
      json(res, result.status, {
        ...result.body,
        replayed: Boolean(result.replayed),
      });
    } catch (error) {
      json(res, error.status || 500, {
        code: error.code || "INTERNAL_ERROR",
        message: error.message,
      });
    }
  });
  return {
    db,
    server,
    listen: () =>
      new Promise((resolve) =>
        server.listen(port, "127.0.0.1", () => resolve(server.address())),
      ),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
