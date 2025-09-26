const express = require("express");
const { fetch } = require("undici");
const app = express();
app.use(express.json());

// Manifesto MCP (o "manual do brinquedo")
const MCP_MANIFEST = {
  name: "base44",
  version: "1.0.0",
  tools: [
    { name: "list_clients", description: "Lista todos os clientes", input_schema: {} },
    { name: "get_client", description: "Busca um cliente pelo ID", input_schema: { id: "string" } },
    { name: "update_client", description: "Atualiza dados de um cliente", input_schema: { id: "string", data: "object" } }
  ]
};

// Teste simples
app.get("/", (req, res) => res.send("MCP Base44 online 🚀"));
app.get("/health", (req, res) => res.json({ ok: true }));

// Retorna o manifesto (fecha resposta)
app.get("/manifest", (req, res) => res.json(MCP_MANIFEST));

// SSE (fica carregando porque é um "stream" de eventos)
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.write(`event: manifest\n`);
  res.write(`data: ${JSON.stringify(MCP_MANIFEST)}\n\n`);
});

// API Base44
const BASE44_URL = "https://app.base44.com/api/apps/680d6ca95153f09fa29b4f1a/entities/Client";
const API_KEY = process.env.API_KEY;

// Lista clientes
app.get("/clients", async (req, res) => {
  const r = await fetch(BASE44_URL, { headers: { api_key: API_KEY, "Content-Type": "application/json" } });
  res.json(await r.json());
});

// Busca cliente
app.get("/clients/:id", async (req, res) => {
  const r = await fetch(`${BASE44_URL}/${req.params.id}`, { headers: { api_key: API_KEY, "Content-Type": "application/json" } });
  res.json(await r.json());
});

// Atualiza cliente
app.put("/clients/:id", async (req, res) => {
  const r = await fetch(`${BASE44_URL}/${req.params.id}`, {
    method: "PUT",
    headers: { api_key: API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(req.body)
  });
  res.json(await r.json());
});

// Executor MCP (ChatGPT chama aqui)
app.post("/mcp/call", async (req, res) => {
  const { tool, args } = req.body;
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
  res.status(400).json({ error: "Tool inválida" });
});

// Sobe servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 MCP rodando na porta " + PORT));
