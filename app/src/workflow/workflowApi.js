const TOKENS = {
  construction: "construction-token",
  receiving: "receiving-token",
  driver: "driver-token",
};
const base = import.meta.env.VITE_WORKFLOW_API_URL || "/api";
const request = async (
  role,
  path,
  { method = "GET", body, version, operationKey } = {},
) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKENS[role]}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(version ? { "if-match": String(version) } : {}),
      ...(operationKey ? { "idempotency-key": operationKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || "APIエラー");
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
};
export const workflowApi = {
  list: (role) => request(role, "/workflow"),
  create: (body, key) =>
    request("construction", "/reservations", {
      method: "POST",
      body,
      operationKey: key,
    }),
  confirm: (id, version, key) =>
    request("receiving", `/reservations/${id}/confirm`, {
      method: "POST",
      body: {},
      version,
      operationKey: key,
    }),
  assign: (id, version, key, rotationNo = 1) =>
    request("construction", `/reservations/${id}/assign`, {
      method: "POST",
      body: { vehicleId: "vehicle-01", driverId: "driver-01", rotationNo },
      version,
      operationKey: key,
    }),
  changeReservation: (id, version, body, key) =>
    request("construction", `/reservations/${id}/change`, {
      method: "POST",
      body,
      version,
      operationKey: key,
    }),
  cancelReservation: (id, version, reason, key) =>
    request("construction", `/reservations/${id}/cancel`, {
      method: "POST",
      body: { reason },
      version,
      operationKey: key,
    }),
  unavailable: (id, version, reason, key) =>
    request("receiving", `/reservations/${id}/unavailable`, {
      method: "POST",
      body: { reason },
      version,
      operationKey: key,
    }),
  reassign: (id, version, key) =>
    request("construction", `/trips/${id}/reassign`, {
      method: "POST",
      body: { vehicleId: "vehicle-02", driverId: "driver-02" },
      version,
      operationKey: key,
    }),
  delay: (id, version, key) =>
    request("driver", `/trips/${id}/delay`, {
      method: "POST",
      body: {
        reason: "交通混雑",
        estimatedArrivalAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      version,
      operationKey: key,
    }),
  report: (id, version, eventType, key) =>
    request("driver", `/trips/${id}/events`, {
      method: "POST",
      body: { eventType },
      version,
      operationKey: key,
    }),
  receipt: (id, version, quantity, key) =>
    request("receiving", `/trips/${id}/receipt/confirm`, {
      method: "POST",
      body: { actualQuantity: quantity, unit: "m3" },
      version,
      operationKey: key,
    }),
  correctReceipt: (id, version, quantity, reason, key) =>
    request("receiving", `/receipts/${id}/correct`, {
      method: "POST",
      body: { actualQuantity: quantity, reason },
      version,
      operationKey: key,
    }),
  operation: (role, key) =>
    request(role, `/operations/${encodeURIComponent(key)}`),
  matching: (role, filters = {}) =>
    request(role, `/matching?${new URLSearchParams(filters)}`),
  createCase: (role, body, operationKey) =>
    request(role, "/matching/cases", { method: "POST", body, operationKey }),
  caseAction: (role, id, action, version, body, operationKey) =>
    request(role, `/matching/cases/${id}/${action}`, {
      method: "POST",
      body,
      version,
      operationKey,
    }),
  consult: (role, body, operationKey) =>
    request(role, "/matching/consultations", {
      method: "POST",
      body,
      operationKey,
    }),
  offer: (role, id, version, terms, message, operationKey) =>
    request(role, `/matching/consultations/${id}/offers`, {
      method: "POST",
      body: { terms, message },
      version,
      operationKey,
    }),
  accept: (role, id, version, operationKey) =>
    request(role, `/matching/consultations/${id}/accept`, {
      method: "POST",
      body: {},
      version,
      operationKey,
    }),
  reserveAgreement: (id, operationKey) =>
    request("construction", `/matching/agreements/${id}/reservation`, {
      method: "POST",
      body: {},
      operationKey,
    }),
};
