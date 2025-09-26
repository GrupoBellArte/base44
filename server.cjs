// ========================
// MCP Base44 - servidor completo
// ========================
const express = require("express");
const { fetch } = require("undici");

const app = express();
app.use(express.json());

// CORS + preflight
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ========================
// CONFIG
// ========================
const API_KEY = process.env.API_KEY; // defina no Render
const BASE44_URL = "https://app.base44.com/api/apps/680d6ca95153f09fa29b4f1a/entities/Client";

// ========================
// MANIFESTO MCP (JSON Schema VÁLIDO)
// ========================
const MCP_MANIFEST = {
  name: "base44",
  version: "1.0.0",
  tools: [
    {
      name: "list_clients",
      description: "Lista todos os clientes",
      input_schema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "get_client",
      description: "Busca um cliente pelo ID",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1 }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "update_client",
      description: "Atualiza dados de um cliente",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1 },
          data: { type: "object" }
        },
        required: ["id", "data"],
        additionalProperties: false
      }
    }
  ]
};

// ========================
/* ROTAS BÁSICAS */
app.get("/", (_req, res) => res.send("MCP Base44 online 🚀"));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/manifest", (_req, res) => res.json(MCP_MANIFEST));

// SSE (endpoint para o Conector MCP)
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write(`event: manifest\n`);
  res.write(`data: ${JSON.stringify(MCP_MANIFEST)}\n\n`);
  const keep = setInterval(() => res.write(`:keepalive\n\n`), 25000);
  req.on("close", () => clearInterval(keep));
});

// ========================
// PROXY BASE44 (GET/PUT)
// ========================
app.get("/clients", async (_req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ ok: false, error: "API_KEY ausente" });
    const r = await fetch(BASE44_URL, { headers: { api_key: API_KEY, "Content-Type": "application/json" } });
    const j = await r.json();
    return res.json(j);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/clients/:id", async (req, res) => {
  try {
    const r = await fetch(`${BASE44_URL}/${encodeURIComponent(req.params.id)}`, {
      headers: { api_key: API_KEY, "Content-Type": "application/json" }
    });
    const j = await r.json();
    return res.json(j);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.put("/clients/:id", async (req, res) => {
  try {
    const r = await fetch(`${BASE44_URL}/${encodeURIComponent(req.params.id)}`, {
      method: "PUT",
      headers: { api_key: API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {})
    });
    const j = await r.json();
    return res.json(j);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ========================
// EXECUTOR DE TOOLS (MCP)
// ========================
const TOOL_ALIASES = {
  list_clients: ["list", "listar", "clients_list"],
  get_client: ["get", "getClient", "cliente", "client_get", "get_client_by_id"],
  update_client: ["update", "atualizar", "updateClient", "client_update"]
};
function resolveToolName(name) {
  if (!name) return null;
  if (MCP_MANIFEST.tools.some(t => t.name === name)) return name;
  for (const [canon, aliases] of Object.entries(TOOL_ALIASES)) {
    if (aliases.includes(name)) return canon;
  }
  return null;
}

// Ajuda se abrir por GET no navegador
app.get("/mcp/call", (_req, res) => {
  res.json({
    ok: false,
    message: "Use POST com { tool, args }. Ex.: { tool:'list_clients', args:{} }",
    tools: MCP_MANIFEST.tools.map(t => ({ name: t.name, description: t.description }))
  });
});

app.post("/mcp/call", async (req, res) => {
  try {
    let { tool, args } = req.body || {};
    const resolved = resolveToolName(tool);
    if (!resolved) return res.status(400).json({ ok: false, error: `tool inválida ou ausente: '${tool}'` });

    if (resolved === "list_clients") {
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients`);
      const j = await r.json();
      return res.json({ ok: true, result: j });
    }

    if (resolved === "get_client") {
      const id = args?.id;
      if (!id) return res.status(400).json({ ok: false, error: "id é obrigatório" });
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients/${encodeURIComponent(id)}`);
      const j = await r.json();
      return res.json({ ok: true, result: j });
    }

    if (resolved === "update_client") {
      const id = args?.id;
      const data = args?.data;
      if (!id || !data) return res.status(400).json({ ok: false, error: "id e data são obrigatórios" });
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const j = await r.json();
      return res.json({ ok: true, result: j });
    }

    return res.status(404).json({ ok: false, error: `tool '${resolved}' não implementada` });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ========================
// START
// ========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 MCP rodando na porta " + PORT));
