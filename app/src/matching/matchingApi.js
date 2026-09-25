export function matchingApi(token) {
  const request = async (path, body, key) => {
    const response = await fetch(path, {
      signal: AbortSignal.timeout(12000),
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(result.error || "APIの応答を確認できません。"),
        { status: response.status },
      );
    return result;
  };
  return {
    login: (email, password) =>
      request("/api/direct/session", { email, password }),
    list: (side, filters) =>
      request(`/api/match/list?${new URLSearchParams({ side, ...filters })}`),
    action: (action, body, key) =>
      request(`/api/match/actions/${action}`, body, key),
    operation: (key) => request(`/api/match/operations/${key}`),
    document: (id, docId) => request(`/api/match/documents/${id}/${docId}`),
  };
}
