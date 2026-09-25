const fail = (status, message) => Object.assign(new Error(message), { status });
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleMatching(req, client, url) {
  const route = url.pathname;
  if (req.method === "GET" && route === "/api/match/list") {
    const side = url.searchParams.get("side");
    const filters = Object.fromEntries(
      [...url.searchParams].filter(([key]) => key !== "side"),
    );
    if (
      filters.quantity &&
      (!filters.unit ||
        !Number.isFinite(Number(filters.quantity)) ||
        Number(filters.quantity) < 0)
    )
      throw fail(422, "数量検索は単位と0以上の数量を指定してください。");
    return {
      data: (
        await client.query("SELECT direct.match_list($1,$2) AS data", [
          side,
          filters,
        ])
      ).rows[0].data,
    };
  }
  if (req.method === "GET" && route.startsWith("/api/match/operations/")) {
    const key = route.split("/").at(-1);
    if (!uuid.test(key)) throw fail(400, "操作IDが不正です。");
    return (
      await client.query("SELECT direct.match_operation($1) AS data", [key])
    ).rows[0].data;
  }
  if (req.method === "GET" && route.startsWith("/api/match/documents/")) {
    const parts = route.split("/");
    if (!uuid.test(parts[4] || "") || !uuid.test(parts[5] || ""))
      throw fail(400, "資料IDが不正です。");
    const doc = (
      await client.query("SELECT direct.match_document($1,$2) AS data", [
        parts[4],
        parts[5],
      ])
    ).rows[0].data;
    return { document: doc };
  }
  if (req.method === "POST" && route.startsWith("/api/match/actions/")) {
    const action = route.split("/").at(-1),
      key = req.headers["idempotency-key"];
    if (
      ![
        "create",
        "edit",
        "publish",
        "close",
        "consult",
        "offer",
        "accept",
        "reserve",
      ].includes(action) ||
      !uuid.test(key || "")
    )
      throw fail(400, "操作または操作IDが不正です。");
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024)
        throw fail(413, "関連資料を含むデータは8MBまでです。");
      chunks.push(chunk);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks));
    } catch {
      throw fail(400, "JSON形式が不正です。");
    }
    if (!body || !uuid.test(body.id || ""))
      throw fail(400, "対象IDが不正です。");
    if (body.data?.documents) {
      for (const doc of body.data.documents) {
        if (!uuid.test(doc.id || "")) throw fail(422, "関連資料IDが不正です。");
        const bytes = Buffer.from(doc.base64 || "", "base64");
        const valid =
          doc.mime === "application/pdf"
            ? bytes.subarray(0, 5).toString() === "%PDF-"
            : doc.mime === "image/png"
              ? bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : doc.mime === "image/jpeg"
                ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
                : false;
        if (!valid || bytes.length > 1048576)
          throw fail(422, "関連資料はPDF・PNG・JPEG、1件1MB以下です。");
      }
    }
    const result = (
      await client.query("SELECT direct.match_mutate($1,$2,$3) AS data", [
        action,
        key,
        body,
      ])
    ).rows[0].data;
    return { operationId: key, ...result };
  }
  throw fail(404, "マッチAPIがありません。");
}
