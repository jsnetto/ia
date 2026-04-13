// Vision-capable models on OpenRouter
const VISION_MODELS = new Set(["openai", "gemini", "claude"]);

const OPENROUTER_MODELS: Record<string, string> = {
  openai:     "openai/gpt-4o",
  gemini:     "google/gemini-2.0-flash-001",
  deepseek:   "deepseek/deepseek-chat",
  perplexity: "perplexity/sonar",
  claude:     "anthropic/claude-3.5-sonnet",
  llama:      "meta-llama/llama-3.3-70b-instruct",
};

const OPENAI_MODELS: Record<string, string> = {
  openai:     "gpt-4o",
  gemini:     "gpt-4o",
  deepseek:   "gpt-4o",
  claude:     "gpt-4o",
  llama:      "gpt-4o",
  perplexity: "gpt-4o",
};

const ANTHROPIC_MODELS: Record<string, string> = {
  claude:     "claude-3-5-sonnet-20241022",
  openai:     "claude-3-5-sonnet-20241022",
  gemini:     "claude-3-5-sonnet-20241022",
  deepseek:   "claude-3-5-sonnet-20241022",
  llama:      "claude-3-5-sonnet-20241022",
  perplexity: "claude-3-5-sonnet-20241022",
};

const TOGETHER_MODELS: Record<string, string> = {
  llama:      "meta-llama/Llama-3-70b-chat-hf",
  openai:     "mistralai/Mixtral-8x7B-Instruct-v0.1",
  deepseek:   "deepseek-ai/deepseek-llm-67b-chat",
  gemini:     "mistralai/Mixtral-8x7B-Instruct-v0.1",
  claude:     "mistralai/Mixtral-8x7B-Instruct-v0.1",
  perplexity: "mistralai/Mixtral-8x7B-Instruct-v0.1",
};

const GROQ_MODELS: Record<string, string> = {
  llama:      "llama3-70b-8192",
  openai:     "llama3-70b-8192",
  deepseek:   "llama3-70b-8192",
  gemini:     "gemma2-9b-it",
  claude:     "llama3-70b-8192",
  perplexity: "llama3-70b-8192",
};

function detectGateway(apiKey: string): string {
  if (!apiKey) return "openrouter";
  if (apiKey.startsWith("sk-or-"))      return "openrouter";
  if (apiKey.startsWith("sk-ant-"))     return "anthropic";
  if (apiKey.startsWith("gsk_"))        return "groq";
  if (apiKey.startsWith("sk-proj-") || apiKey.startsWith("sk-")) return "openai";
  if (apiKey.length > 60)               return "together";
  return "openrouter";
}

function getGatewayConfig(gateway: string, apiKey: string, model: string) {
  switch (gateway) {
    case "openai":
      return { url: "https://api.openai.com/v1/chat/completions", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }, modelId: OPENAI_MODELS[model] || "gpt-4o" };
    case "anthropic":
      return { url: "https://api.anthropic.com/v1/messages", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, modelId: ANTHROPIC_MODELS[model] || "claude-3-5-sonnet-20241022" };
    case "together":
      return { url: "https://api.together.xyz/v1/chat/completions", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }, modelId: TOGETHER_MODELS[model] || "meta-llama/Llama-3-70b-chat-hf" };
    case "groq":
      return { url: "https://api.groq.com/openai/v1/chat/completions", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }, modelId: GROQ_MODELS[model] || "llama3-70b-8192" };
    default: // openrouter
      return { url: "https://openrouter.ai/api/v1/chat/completions", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "https://smart-boy-app-0e7bef6a.base44.app", "X-Title": "JonasNetto IA" }, modelId: OPENROUTER_MODELS[model] || model };
  }
}

// Build message content — supports text + image (base64 data URL)
function buildMessageContent(prompt: string, imageBase64?: string, gateway?: string, model?: string): unknown {
  if (!imageBase64) return prompt;

  // Only send image to vision-capable models
  const canVision = gateway === "openrouter" ? VISION_MODELS.has(model || "") : (gateway === "openai" || gateway === "anthropic");
  if (!canVision) return prompt + "\n\n[Nota: imagem anexada, mas este modelo não suporta visão]";

  // Anthropic content format
  if (gateway === "anthropic") {
    const mediaType = imageBase64.split(";")[0].split(":")[1] || "image/jpeg";
    const base64Data = imageBase64.split(",")[1];
    return [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
      { type: "text", text: prompt },
    ];
  }

  // OpenAI-compatible format (OpenRouter, OpenAI)
  return [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageBase64 } },
  ];
}

async function callModel(gateway: string, config: { url: string; headers: Record<string, string>; modelId: string }, prompt: string, imageBase64?: string, model?: string): Promise<string> {
  const content = buildMessageContent(prompt, imageBase64, gateway, model);

  if (gateway === "anthropic") {
    const res = await fetch(config.url, {
      method: "POST", headers: config.headers,
      body: JSON.stringify({ model: config.modelId, max_tokens: 1500, messages: [{ role: "user", content }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Erro Anthropic");
    return data.content[0].text;
  }

  const res = await fetch(config.url, {
    method: "POST", headers: config.headers,
    body: JSON.stringify({ model: config.modelId, messages: [{ role: "user", content }], max_tokens: 1500 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Erro na API");
  return data.choices[0].message.content;
}

Deno.serve(async (req) => {
  const ALLOWED_ORIGINS = [
    "https://ia.jonasnetto.com.br",
    "https://smart-boy-app-0e7bef6a.base44.app",
  ];
  const reqOrigin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, models, apiKey, imageBase64 } = body;

    if (!prompt) return Response.json({ error: "Prompt é obrigatório" }, { status: 400, headers: corsHeaders });

    // Se o cliente não enviou apiKey, busca do servidor (manageApiKey)
    let OPENROUTER_API_KEY = apiKey || "";
    if (!OPENROUTER_API_KEY) {
      try {
        const keyRes = await fetch("https://smart-boy-67510347.base44.app/functions/manageApiKey", {
          method: "POST",
          headers: { "Content-Type": "application/json", "origin": "https://smart-boy-app-0e7bef6a.base44.app" },
          body: JSON.stringify({ action: "getKey", adminPassword: "Admin@JN2025" }),
        });
        const keyData = await keyRes.json();
        OPENROUTER_API_KEY = keyData.apiKey || "";
      } catch { /* usa vazio */ }
    }
    if (!OPENROUTER_API_KEY) return Response.json({ error: "API Key não configurada. Acesse ⚙️ Configurações." }, { status: 400, headers: corsHeaders });
    const gateway = detectGateway(OPENROUTER_API_KEY);
    const selectedModels: string[] = models || ["openai", "gemini", "deepseek"];
    const results: Record<string, { response?: string; error?: string; time?: number; gateway?: string }> = {};

    const tasks = selectedModels.map(async (model: string) => {
      const start = Date.now();
      try {
        const config = getGatewayConfig(gateway, OPENROUTER_API_KEY, model);
        const response = await callModel(gateway, config, prompt, imageBase64, model);
        results[model] = { response, time: Date.now() - start, gateway };
      } catch (err) {
        results[model] = { error: err.message, time: Date.now() - start, gateway };
      }
    });

    await Promise.all(tasks);
    return Response.json({ results, gateway }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
