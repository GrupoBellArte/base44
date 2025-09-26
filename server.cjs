const express = require("express");
const { fetch } = require("undici");
const app = express();
app.use(express.json());

// ========================
// MANIFESTO MCP
// ========================
const MCP_MANIFEST = {
  name: "base44",
  version: "1.0.0",
  tools: [
    { name: "list_clients", description: "Lista todos os clientes", input_schema: {} },
    { name: "get_client", description: "Busca um cliente pelo ID", input_schema: { id: "string" } },
    { name: "update_client", description: "Atualiza dados de um cliente", input_schema: { id: "string", data: "object" } }
  ]
};

// ========================
// ROTAS BÁSICAS
// ========================
app.get("/", (req, res) => res.send("MCP Base44 online 🚀"));
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/manifest", (req, res) => res.json(MCP_MANIFEST));

// SSE (stream infinito)
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.write(`event: manifest\n`);
  res.write(`data: ${JSON.stringify(MCP_MANIFEST)}\n\n`);
});

// ========================
// API BASE44 (proxy)
// ========================
const BASE44_URL = "https://app.base44.com/api/apps/680d6ca95153f09fa29b4f1a/entities/Client";
const API_KEY = process.env.API_KEY;

// Listar clientes
app.get("/clients", async (req, res) => {
  const r = await fetch(BASE44_URL, { headers: { api_key: API_KEY, "Content-Type": "application/json" } });
  res.json(await r.json());
});

// Buscar cliente por ID
app.get("/clients/:id", async (req, res) => {
  const r = await fetch(`${BASE44_URL}/${req.params.id}`, { headers: { api_key: API_KEY, "Content-Type": "application/json" } });
  res.json(await r.json());
});

// Atualizar cliente por ID
app.put("/clients/:id", async (req, res) => {
  const r = await fetch(`${BASE44_URL}/${req.params.id}`, {
    method: "PUT",
    headers: { api_key: API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(req.body)
  });
  res.json(await r.json());
});

// ========================
// EXECUTOR MCP
// ========================
app.post("/mcp/call", async (req, res) => {
  const { tool, args } = req.body;

  try {
    if (tool === "list_clients") {
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients`);
      return res.json(await r.json());
    }

    if (tool === "get_client") {
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients/${args.id}`);
      return res.json(await r.json());
    }

    if (tool === "update_client") {
      const r = await fetch(`${req.protocol}://${req.get("host")}/clients/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.data)
      });
      return res.json(await r.json());
    }

    res.status(400).json({ error: "Tool inválida ou não implementada" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========================
// SUBIR SERVIDOR
// ========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 MCP rodando na porta " + PORT));
