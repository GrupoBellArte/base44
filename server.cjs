// server.cjs
const express = require("express");
const { fetch } = require("undici"); // garante fetch em qualquer runtime
const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY; // definida no Render
const BASE44_API = "https://app.base44.com/api/apps/680d6ca95153f09fa29b4f1a/entities/Client";

// --- rotas básicas ---
app.get("/", (_, res) => res.send("MCP Base44 online"));
app.get("/health", (_, res) => res.json({ ok: true }));

// --- normalização ---
const normalize = (r) => ({
  id: r?._id ?? r?.id ?? r?.uuid,
  name: r?.name ?? null,
  email: r?.email ?? null,
  phone: r?.phone ?? null,
  company: r?.company ?? null,
  status: r?.status ?? null,
  raw: r
});

// --- rotas REST para sua API ---
app.get("/clients", async (_, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ ok: false, error: "API_KEY ausente" });
    const resp = await fetch(BASE44_API, { headers: { "api_key": API_KEY, "Content-Type": "application/json" } });
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: await resp.text() });
    const json = await resp.json();
    const arr = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : [json]);
    res.json({ ok: true, data: arr.map(normalize) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get("/clients/:id", async (req, res) => {
  try {
    const url = `${BASE44_API}/${encodeURIComponent(req.params.id)}`;
    const resp = await fetch(url, { headers: { "api_key": API_KEY, "Content-Type": "application/json" } });
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: await resp.text() });
    const json = await resp.json();
    res.json({ ok: true, data: normalize(json?.data ?? json) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.put("/clients/:id", async (req, res) => {
  try {
    const url = `${BASE44_API}/${encodeURIComponent(req.params.id)}`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "api_key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {})
    });
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: await resp.text() });
    const json = await resp.json();
    res.json({ ok: true, data: normalize(json?.data ?? json) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// --- Manifesto MCP + SSE ---
const MCP_MANIFEST = {
  name: "base44",
  version: "1.0.0",
  tools: [
    { name: "list_clients", description: "Lista clientes do sistema Base44", input_schema: { type: "object", properties: {} } },
    { name: "get_client", description: "Busca um cliente por ID", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
    { name: "update_client", description: "Atualiza um cliente por ID", input_schema: { type: "object", properties: { id: { type: "string" }, data: { type: "object" } }, required: ["id","data"] } }
  ]
};

app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`event: manifest\n`);
  res.write(`data: ${JSON.stringify(MCP_MANIFEST)}\n\n`);
  const interval = setInterval(() => res.write(`event: ping\ndata: {}\n\n`), 25000);
  req.on("close", () => clearInterval(interval));
});

// útil para testar manifesto sem stream
app.get("/manifest", (_, res) => res.json(MCP_MANIFEST));

// executor das tools
app.post("/mcp/call", async (req, res) => {
  try {
    const { tool, args = {} } = req.body || {};
    if (!tool) return res.status(400).json({ ok: false, error: "tool ausente" });

    if (tool === "list_clients") {
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients`);
      const j = await r.json();
      return res.json({ ok: true, result: j.data });
    }
    if (tool === "get_client") {
      const { id } = args;
      if (!id) return res.status(400).json({ ok: false, error: "id é obrigatório" });
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients/${encodeURIComponent(id)}`);
      const j = await r.json();
      return res.json({ ok: true, result: j.data });
    }
    if (tool === "update_client") {
      const { id, data } = args;
      if (!id || !data) return res.status(400).json({ ok: false, error: "id e data são obrigatórios" });
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const j = await r.json();
      return res.json({ ok: true, result: j.data });
    }

    return res.status(404).json({ ok: false, error: `tool '${tool}' não encontrada` });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP rodando na porta ${PORT}`));
