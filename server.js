// server.js
import express from "express";

const app = express();
app.use(express.json());

// ⚠️ O token VAI pelas variáveis de ambiente (Render -> Environment Variables)
const API_KEY = process.env.API_KEY;
const BASE44_API = "https://app.base44.com/api/apps/680d6ca95153f09fa29b4f1a/entities/Client";

// Rota de saúde (para testar se está no ar)
app.get("/", (req, res) => res.send("MCP Base44 online"));
app.get("/health", (req, res) => res.json({ ok: true }));

// Normalização da resposta do Base44 para um formato único
function normalizeClient(raw) {
  return {
    id: raw?._id ?? raw?.id ?? raw?.uuid,
    name: raw?.name ?? null,
    email: raw?.email ?? null,
    phone: raw?.phone ?? null,
    company: raw?.company ?? null,
    status: raw?.status ?? null,
    raw // mantém o objeto original para depuração
  };
}

// Listar clientes
app.get("/clients", async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ ok: false, error: "API_KEY ausente" });

    const resp = await fetch(BASE44_API, {
      headers: {
        "api_key": API_KEY,
        "Content-Type": "application/json"
      }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ ok: false, error: "Base44 error", details: text });
    }

    const json = await resp.json();
    const arr = Array.isArray(json?.data) ? json.data :
                Array.isArray(json) ? json : [json];

    const data = arr.map(normalizeClient);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Obter 1 cliente por ID
app.get("/clients/:id", async (req, res) => {
  try {
    const url = `${BASE44_API}/${encodeURIComponent(req.params.id)}`;
    const resp = await fetch(url, {
      headers: { "api_key": API_KEY, "Content-Type": "application/json" }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ ok: false, error: "Base44 error", details: text });
    }

    const json = await resp.json();
    res.json({ ok: true, data: normalizeClient(json?.data ?? json) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Atualizar cliente por ID (repasse direto ao Base44)
app.put("/clients/:id", async (req, res) => {
  try {
    const url = `${BASE44_API}/${encodeURIComponent(req.params.id)}`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "api_key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {})
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ ok: false, error: "Base44 error", details: text });
    }

    const json = await resp.json();
    res.json({ ok: true, data: normalizeClient(json?.data ?? json) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP rodando na porta ${PORT}`));
