import { resolve } from "node:path";
import { createWorkflowServer } from "./workflow-api.mjs";

const port = Number(process.env.ECODUMP_API_PORT || 4180);
const dbPath = resolve(process.env.ECODUMP_DB_PATH || ".local-data/ecodump-isolated.sqlite");
const api = createWorkflowServer({ dbPath, port });
await api.listen();
console.log(`ECO DUMP isolated API: http://127.0.0.1:${port} (${dbPath})`);
