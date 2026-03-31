import { useState, useEffect } from "react";
import { ResearchHistory } from "@/api/entities";

const MODELS = [
  { id: "openai",     name: "ChatGPT",    icon: "🤖", color: "#10a37f" },
  { id: "gemini",     name: "Gemini",     icon: "✨", color: "#4285F4" },
  { id: "deepseek",   name: "DeepSeek",   icon: "🔍", color: "#6366f1" },
  { id: "claude",     name: "Claude",     icon: "🧡", color: "#e07b39" },
  { id: "perplexity", name: "Perplexity", icon: "🌐", color: "#20b2aa" },
  { id: "llama",      name: "Llama 3",    icon: "🦙", color: "#a855f7" },
];

const GATEWAYS = [
  { id: "openrouter", name: "OpenRouter",  url: "openrouter.ai",         prefix: "sk-or-",        color: "#6366f1", description: "Acesso a 100+ modelos com uma só chave" },
  { id: "openai",     name: "OpenAI",      url: "platform.openai.com",   prefix: "sk-proj-",      color: "#10a37f", description: "Direto para GPT-4o e outros modelos OpenAI" },
  { id: "anthropic",  name: "Anthropic",   url: "console.anthropic.com", prefix: "sk-ant-",       color: "#e07b39", description: "Direto para Claude 3.5 Sonnet" },
  { id: "together",   name: "Together AI", url: "api.together.xyz",      prefix: "(token longo)", color: "#0ea5e9", description: "Modelos open source: Llama, Mistral" },
  { id: "groq",       name: "Groq",        url: "console.groq.com",      prefix: "gsk_",          color: "#f59e0b", description: "Ultra-rápido, modelos open source gratuitos" },
];

const THEMES = [
  { id: "light",         label: "☀️ Light Minimalista" },
  { id: "dark-refined",  label: "🌑 Dark Refinado" },
  { id: "glassmorphism", label: "🪟 Dark + Glass" },
];

const DEFAULT_SETTINGS = {
  apiKey: "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",
  consolidationModel: "claude",
  theme: "light",
};

function loadSettings() {
  try {
    const saved = localStorage.getItem("smartboy_settings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s) { localStorage.setItem("smartboy_settings", JSON.stringify(s)); }

function loadSavedPrompts() {
  try { return JSON.parse(localStorage.getItem("jn_saved_prompts") || "[]"); } catch { return []; }
}
function saveSavedPrompts(arr) { localStorage.setItem("jn_saved_prompts", JSON.stringify(arr)); }

function detectGateway(apiKey) {
  if (!apiKey) return "openrouter";
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("gsk_")) return "groq";
  if (apiKey.startsWith("sk-proj-") || apiKey.startsWith("sk-")) return "openai";
  if (apiKey.length > 60) return "together";
  return "openrouter";
}

function formatText(text, isLight) {
  if (!text) return "";
  const codeBg = isLight ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.3)";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, `<code style='background:${codeBg};padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.85em'>$1</code>`)
    .replace(/\n/g, "<br/>");
}

function buildFullPrompt(context, history, useHistory, prompt) {
  const parts = [];
  if (context.area)     parts.push("Minha Area: " + context.area);
  if (context.tema)     parts.push("Tema: " + context.tema);
  if (context.objetivo) parts.push("Objetivo Geral: " + context.objetivo);
  if (context.dados)    parts.push("Dados/Contexto: " + context.dados);
  if (context.acao)     parts.push("Acao Esperada: " + context.acao);
  let result = "";
  if (parts.length > 0) result += "[Perfil da Pesquisa]\n" + parts.join("\n") + "\n\n";
  if (useHistory && history.length > 0) {
    const histText = history.map(h => "Voce: " + h.question + "\nIA: " + h.answer).join("\n\n");
    result += "[Historico da Conversa]\n" + histText + "\n\n";
  }
  result += "[Pergunta]\n" + prompt;
  return result;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ");
}

function exportToTxt(question, results, consolidated) {
  const lines = ["JonasNetto IA — Exportação de Pesquisa", "=".repeat(50), "", "PERGUNTA:", question, ""];
  Object.entries(results).forEach(([id, r]) => {
    const m = MODELS.find(x => x.id === id);
    lines.push("─".repeat(40));
    lines.push((m ? m.icon + " " + m.name : id).toUpperCase());
    lines.push("─".repeat(40));
    lines.push(r.error ? "ERRO: " + r.error : r.response || "");
    lines.push("");
  });
  if (consolidated) {
    lines.push("=".repeat(50));
    lines.push("✨ CONSOLIDAÇÃO");
    lines.push("=".repeat(50));
    lines.push(consolidated);
  }
  lines.push("", "Gerado em: " + new Date().toLocaleString("pt-BR"));
  return lines.join("\n");
}

const APP_URL = "https://smart-boy-app-0e7bef6a.base44.app";

const CONTEXT_FIELDS = [
  { key: "area",     label: "Minha Área",      labelEn: "My Field / Area",    placeholder: "Ex: Medicina, Tecnologia, Direito..." },
  { key: "tema",     label: "Tema",             labelEn: "Topic / Theme",      placeholder: "Ex: Inteligência Artificial na saúde" },
  { key: "objetivo", label: "Objetivo Geral",   labelEn: "General Objective",  placeholder: "Ex: Escrever um artigo acadêmico" },
  { key: "dados",    label: "Dados / Contexto", labelEn: "Data / Background",  placeholder: "Ex: Estudo com 200 pacientes, 2023-2024" },
  { key: "acao",     label: "Ação Esperada",    labelEn: "Expected Action",    placeholder: "Ex: Sugira uma introdução formal" },
];

function getTheme(themeId) {
  if (themeId === "light") return {
    isLight: true, isGlass: false,
    bg: "#ffffff", surface: "#fafafa", surfaceBorder: "#e5e7eb",
    card: "#fafafa", cardBorder: "#e5e7eb", cardBlur: "none",
    cardShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    input: "#ffffff", inputBorder: "#d1d5db",
    text: "#111827", textMuted: "#6b7280", textDim: "#9ca3af",
    accent: "#001969",
    consolidateBg: "#fffbeb", consolidateBorder: "#fcd34d",
    modalBg: "#ffffff", modalBorder: "#e5e7eb",
    modalShadow: "0 20px 60px rgba(0,0,0,0.15)",
    pillActive: (c) => c + "14", pillBorder: (c) => c + "55",
    skeleton: "#f3f4f6", headingGradient: "#001969",
    errorBg: "#fef2f2", errorBorder: "#fecaca", errorText: "#dc2626",
    histBg: "#f8faff", histBorder: "#dbeafe",
  };
  if (themeId === "glassmorphism") return {
    isLight: false, isGlass: true,
    bg: "linear-gradient(135deg, #0a0f1e 0%, #0d1117 50%, #0a0e1a 100%)",
    surface: "rgba(255,255,255,0.04)", surfaceBorder: "rgba(255,255,255,0.08)",
    card: "rgba(255,255,255,0.05)", cardBorder: "rgba(255,255,255,0.1)",
    cardBlur: "blur(12px)", cardShadow: "none",
    input: "rgba(0,0,0,0.3)", inputBorder: "rgba(255,255,255,0.1)",
    text: "#f1f5f9", textMuted: "#94a3b8", textDim: "#475569",
    accent: "#818cf8",
    consolidateBg: "rgba(245,158,11,0.12)", consolidateBorder: "rgba(245,158,11,0.25)",
    modalBg: "rgba(10,15,30,0.95)", modalBorder: "rgba(255,255,255,0.1)",
    modalShadow: "0 32px 80px rgba(0,0,0,0.6)",
    pillActive: (c) => c + "28", pillBorder: (c) => c + "88",
    skeleton: "rgba(255,255,255,0.06)",
    headingGradient: "linear-gradient(135deg, #e0e7ff, #c4b5fd, #93c5fd)",
    errorBg: "rgba(220,38,38,0.08)", errorBorder: "rgba(220,38,38,0.3)", errorText: "#fca5a5",
    histBg: "rgba(129,140,248,0.08)", histBorder: "rgba(129,140,248,0.2)",
  };
  return {
    isLight: false, isGlass: false,
    bg: "#09090b", surface: "#111113", surfaceBorder: "#1f1f23",
    card: "#111113", cardBorder: "#1f1f23", cardBlur: "none", cardShadow: "none",
    input: "#0d0d0f", inputBorder: "#2a2a2e",
    text: "#fafafa", textMuted: "#a1a1aa", textDim: "#52525b",
    accent: "#818cf8",
    consolidateBg: "#111113", consolidateBorder: "#2a2a2e",
    modalBg: "#111113", modalBorder: "#1f1f23",
    modalShadow: "0 32px 80px rgba(0,0,0,0.6)",
    pillActive: (c) => c + "18", pillBorder: (c) => c + "66",
    skeleton: "#1f1f23",
    headingGradient: "linear-gradient(135deg, #e2e8f0, #a5b4fc)",
    errorBg: "rgba(220,38,38,0.08)", errorBorder: "rgba(220,38,38,0.3)", errorText: "#fca5a5",
    histBg: "rgba(129,140,248,0.06)", histBorder: "rgba(129,140,248,0.15)",
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────
const APP_PASSWORD = "Cloud@bdx1";
function checkAuth() { try { return localStorage.getItem("jn_auth") === "ok"; } catch { return false; } }

function LoginScreen({ onAuth }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const handleLogin = () => {
    if (pwd === APP_PASSWORD) { localStorage.setItem("jn_auth", "ok"); onAuth(); }
    else { setError(true); setPwd(""); setTimeout(() => setError(false), 2000); }
  };
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 380, padding: 40, border: "1px solid #e5e7eb", borderRadius: 20, boxShadow: "0 4px 32px rgba(0,0,0,0.08)", background: "#fff", textAlign: "center" }}>
        <img src="https://media.base44.com/images/public/69bd9feba10b3ecf67510347/0a59cfd74_JN8.png" alt="JonasNetto IA" style={{ height: 80, width: "auto", marginBottom: 8, filter: "brightness(0) saturate(100%) invert(8%) sepia(82%) saturate(2700%) hue-rotate(218deg) brightness(90%) contrast(120%)" }} />
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#001969", margin: "0 0 4px" }}>JonasNetto IA</h1>
        <p style={{ color: "#9ca3af", fontSize: "0.85rem", marginBottom: 28 }}>Digite a senha para acessar</p>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Senha de acesso" autoFocus
            style={{ width: "100%", padding: "11px 44px 11px 14px", borderRadius: 10, boxSizing: "border-box", border: "1.5px solid " + (error ? "#fca5a5" : "#d1d5db"), fontSize: "0.95rem", outline: "none", fontFamily: "inherit", color: "#111827", background: error ? "#fef2f2" : "#fff" }} />
          <button onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", color: "#9ca3af" }}>{showPwd ? "🙈" : "👁️"}</button>
        </div>
        {error && <p style={{ color: "#dc2626", fontSize: "0.82rem", margin: "0 0 12px" }}>Senha incorreta. Tente novamente.</p>}
        <button onClick={handleLogin} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "#001969", color: "#fff", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 2px 10px rgba(0,25,105,0.25)" }}>Entrar</button>
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose, onThemeChange }) {
  const [settings, setSettings] = useState(loadSettings());
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const T = getTheme(settings.theme);
  const detectedGateway = detectGateway(settings.apiKey);
  const gatewayInfo = GATEWAYS.find((g) => g.id === detectedGateway);
  const handleSave = () => { saveSettings(settings); onThemeChange(settings.theme); setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 900); };
  const inputStyle = { width: "100%", background: T.input, border: "1px solid " + T.inputBorder, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: "0.9rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, background: T.isLight ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.modalBg, borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, border: "1px solid " + T.modalBorder, boxShadow: T.modalShadow, backdropFilter: T.isGlass ? "blur(20px)" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26 }}>
          <span style={{ fontSize: "1.2rem" }}>⚙️</span>
          <div><h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: T.text }}>Configurações</h2><p style={{ margin: 0, fontSize: "0.75rem", color: T.textDim }}>Settings</p></div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 7 }}><span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase" }}>Chave API / API Key</span></div>
          <div style={{ position: "relative" }}>
            <input type={showKey ? "text" : "password"} value={settings.apiKey} onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })} style={{ ...inputStyle, paddingRight: 44 }} placeholder="sk-or-..." />
            <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1rem" }}>{showKey ? "🙈" : "👁️"}</button>
          </div>
          {gatewayInfo && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: T.pillActive(gatewayInfo.color), border: "1px solid " + T.pillBorder(gatewayInfo.color) }}>
              <span style={{ color: gatewayInfo.color, fontWeight: 700, fontSize: "0.8rem" }}>✓ {gatewayInfo.name}</span>
              <span style={{ color: T.textMuted, fontSize: "0.78rem", marginLeft: 8 }}>{gatewayInfo.description}</span>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 7 }}><span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase" }}>Tema / Theme</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => setSettings({ ...settings, theme: t.id })} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + (settings.theme === t.id ? T.accent : T.inputBorder), background: settings.theme === t.id ? T.accent + "18" : T.input, color: settings.theme === t.id ? T.accent : T.textMuted, fontWeight: settings.theme === t.id ? 700 : 500, cursor: "pointer", fontSize: "0.85rem" }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 7 }}><span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase" }}>Modelo para Consolidação</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {MODELS.map((m) => {
              const active = settings.consolidationModel === m.id;
              return (
                <button key={m.id} onClick={() => setSettings({ ...settings, consolidationModel: m.id })} style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid " + (active ? m.color + "66" : T.inputBorder), background: active ? m.color + "12" : T.input, color: active ? m.color : T.textMuted, fontWeight: active ? 700 : 500, cursor: "pointer", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 7 }}>
                  {m.icon} {m.name}
                  {active && <span style={{ marginLeft: "auto", background: m.color, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: "0.66rem" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={handleSave} style={{ width: "100%", padding: "11px", background: saved ? "#16a34a" : T.accent, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
          {saved ? "✅ Salvo!" : "💾 Salvar"}
        </button>
      </div>
    </div>
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────
function HistoryModal({ onClose, onRestore, T }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    ResearchHistory.list({ sort: "-created_date", limit: 50 }).then(h => { setHistory(h); setLoading(false); });
  }, []);

  const handleDelete = async (id) => {
    setDeleting(id);
    await ResearchHistory.delete(id);
    setHistory(prev => prev.filter(h => h.id !== id));
    setDeleting(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.isLight ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.modalBg, borderRadius: 16, padding: 0, width: "100%", maxWidth: 680, maxHeight: "85vh", border: "1px solid " + T.modalBorder, boxShadow: T.modalShadow, backdropFilter: T.isGlass ? "blur(20px)" : "none", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid " + T.modalBorder, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: T.text }}>📚 Histórico de Pesquisas</h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: T.textDim }}>Research History · {history.length} consulta{history.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {loading && <div style={{ color: T.textMuted, textAlign: "center", padding: 40, fontSize: "0.88rem" }}>Carregando...</div>}
          {!loading && history.length === 0 && <div style={{ color: T.textMuted, textAlign: "center", padding: 40, fontSize: "0.88rem" }}>Nenhuma pesquisa salva ainda.<br/><em style={{ fontSize: "0.8rem", opacity: 0.7 }}>No saved research yet.</em></div>}
          {!loading && history.map((h) => {
            const isExp = expanded === h.id;
            const models = (h.models_used || []).map(id => MODELS.find(m => m.id === id)).filter(Boolean);
            const date = new Date(h.created_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
            return (
              <div key={h.id} style={{ background: T.histBg, border: "1px solid " + T.histBorder, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => setExpanded(isExp ? null : h.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: T.text, fontSize: "0.88rem", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isExp ? "normal" : "nowrap" }}>{h.question}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.72rem", color: T.textDim }}>{date}</span>
                      {models.map(m => <span key={m.id} style={{ fontSize: "0.7rem", color: m.color, background: m.color + "15", borderRadius: 999, padding: "1px 7px" }}>{m.icon} {m.name}</span>)}
                      {h.consolidated && <span style={{ fontSize: "0.7rem", color: "#f59e0b", background: "rgba(245,158,11,0.12)", borderRadius: 999, padding: "1px 7px" }}>✨ Consolidado</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); onRestore(h); onClose(); }} title="Restaurar" style={{ background: T.accent + "18", border: "1px solid " + T.accent + "44", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: T.accent, fontSize: "0.75rem", fontWeight: 600 }}>↩ Restaurar</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(h.id); }} disabled={deleting === h.id} style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "#ef4444", fontSize: "0.75rem" }}>🗑️</button>
                  </div>
                </div>
                {isExp && (
                  <div style={{ padding: "0 16px 14px", borderTop: "1px solid " + T.modalBorder }}>
                    {Object.entries(h.results || {}).map(([id, r]) => {
                      const m = MODELS.find(x => x.id === id);
                      return (
                        <div key={id} style={{ marginTop: 10 }}>
                          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: m ? m.color : T.textMuted, marginBottom: 4 }}>{m ? m.icon + " " + m.name : id}</div>
                          <div style={{ fontSize: "0.82rem", color: T.text, lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }} dangerouslySetInnerHTML={{ __html: formatText(r.response || r.error || "", T.isLight) }} />
                        </div>
                      );
                    })}
                    {h.consolidated && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: T.consolidateBg, borderRadius: 8, border: "1px solid " + T.consolidateBorder }}>
                        <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>✨ Consolidação</div>
                        <div style={{ fontSize: "0.82rem", color: T.text, lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }} dangerouslySetInnerHTML={{ __html: formatText(h.consolidated, T.isLight) }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Saved Prompts Modal ──────────────────────────────────────────────────────
function SavedPromptsModal({ onClose, onSelect, currentPrompt, T }) {
  const [prompts, setPrompts] = useState(loadSavedPrompts());
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!currentPrompt.trim() || !newName.trim()) return;
    setSaving(true);
    const updated = [{ id: Date.now(), name: newName.trim(), text: currentPrompt }, ...prompts].slice(0, 20);
    saveSavedPrompts(updated);
    setPrompts(updated);
    setNewName("");
    setSaving(false);
  };

  const handleDelete = (id) => {
    const updated = prompts.filter(p => p.id !== id);
    saveSavedPrompts(updated);
    setPrompts(updated);
  };

  const inputSt = { width: "100%", background: T.input, border: "1px solid " + T.inputBorder, borderRadius: 8, padding: "9px 12px", color: T.text, fontSize: "0.88rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.isLight ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.modalBg, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "80vh", border: "1px solid " + T.modalBorder, boxShadow: T.modalShadow, backdropFilter: T.isGlass ? "blur(20px)" : "none", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid " + T.modalBorder, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: T.text }}>⭐ Prompts Salvos</h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: T.textDim }}>Saved Prompts · {prompts.length}/20</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + T.modalBorder }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: T.textMuted }}>Salvar pergunta atual:</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} placeholder="Nome do template..." style={{ ...inputSt, flex: 1 }} />
            <button onClick={handleSave} disabled={!newName.trim() || !currentPrompt.trim()} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap" }}>💾 Salvar</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {prompts.length === 0 && <div style={{ color: T.textMuted, textAlign: "center", padding: 30, fontSize: "0.85rem" }}>Nenhum prompt salvo ainda.<br/><em style={{ fontSize: "0.78rem", opacity: 0.7 }}>No saved prompts yet.</em></div>}
          {prompts.map(p => (
            <div key={p.id} style={{ background: T.histBg, border: "1px solid " + T.histBorder, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: T.accent, marginBottom: 3 }}>⭐ {p.name}</div>
                <div style={{ fontSize: "0.78rem", color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.text}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => { onSelect(p.text); onClose(); }} style={{ background: T.accent + "18", border: "1px solid " + T.accent + "44", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: T.accent, fontSize: "0.75rem", fontWeight: 600 }}>Usar</button>
                <button onClick={() => handleDelete(p.id)} style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", color: "#ef4444", fontSize: "0.75rem" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Attachment Helpers ───────────────────────────────────────────────────────
async function readTextFile(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = reject; r.readAsText(file); });
}
async function readImageAsBase64(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = reject; r.readAsDataURL(file); });
}
async function extractPdfText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!window.pdfjsLib) {
          await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const pdf = await window.pdfjsLib.getDocument({ data: e.target.result }).promise;
        let text = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) { const page = await pdf.getPage(i); const tc = await page.getTextContent(); text += tc.items.map(item => item.str).join(" ") + "\n"; }
        resolve(text.trim() || "[PDF sem texto extraível]");
      } catch (err) { resolve("[Erro ao ler PDF: " + err.message + "]"); }
    };
    reader.readAsArrayBuffer(file);
  });
}
async function extractWordText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!window.mammoth) {
          await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js";
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        const result = await window.mammoth.extractRawText({ arrayBuffer: e.target.result });
        resolve(result.value.trim() || "[Documento Word sem texto extraível]");
      } catch (err) {
        resolve("[Erro ao ler Word: " + err.message + "]");
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

async function processFile(file) {
  const type = file.type; const name = file.name;
  if (type === "text/plain") return { name, kind: "text", content: await readTextFile(file) };
  if (type === "application/pdf") return { name, kind: "pdf", content: await extractPdfText(file) };
  if (type.startsWith("image/")) return { name, kind: "image", content: await readImageAsBase64(file) };
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || type === "application/msword" || name.endsWith(".docx") || name.endsWith(".doc")) {
    const text = await extractWordText(file);
    return { name, kind: "word", content: text };
  }
  return { name, kind: "unsupported", content: "" };
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text, T }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  return (
    <button onClick={handleCopy} title="Copiar / Copy" style={{ background: copied ? (T.isLight ? "#dcfce7" : "rgba(34,197,94,0.15)") : T.surface, border: "1px solid " + (copied ? "#86efac" : T.surfaceBorder), borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: copied ? "#16a34a" : T.textMuted, fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s" }}>
      {copied ? "✅ Copiado!" : "📋 Copiar"}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [authed, setAuthed] = useState(checkAuth());
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState(["openai", "gemini", "deepseek"]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState({ area: "", tema: "", objetivo: "", dados: "", acao: "" });
  const [consolidated, setConsolidated] = useState("");
  const [consolidating, setConsolidating] = useState(false);
  const [showConsolidated, setShowConsolidated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeGateway, setActiveGateway] = useState(null);
  const [theme, setTheme] = useState(loadSettings().theme || "light");
  const [chatHistory, setChatHistory] = useState([]);
  const [useHistory, setUseHistory] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [speedRanking, setSpeedRanking] = useState([]);

  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />;

  const T = getTheme(theme);
  const settings = loadSettings();
  const hasContext = Object.values(context).some((v) => v.trim() !== "");
  const hasResults = Object.keys(results).length > 0;
  const successfulResults = Object.entries(results).filter(([, r]) => r.response && !r.error);
  const consolidationModelInfo = MODELS.find((m) => m.id === settings.consolidationModel) || MODELS[3];
  const gatewayInfo = GATEWAYS.find((g) => g.id === activeGateway);

  const toggleModel = (id) => setSelectedModels((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  const imageAttachment = attachments.find(a => a.kind === "image")?.content || null;

  const handleQuery = async () => {
    if (!prompt.trim() && attachments.length === 0) return;
    if (selectedModels.length === 0) return;
    setLoading(true); setError(""); setResults({}); setConsolidated(""); setShowConsolidated(false); setActiveGateway(null); setSpeedRanking([]);
    const currentSettings = loadSettings();
    try {
      let fullPrompt = buildFullPrompt(context, chatHistory, useHistory, prompt);
      const imageAttachment = attachments.find(a => a.kind === "image")?.content || undefined;
      const textAttachments = attachments.filter(a => a.kind === "text" || a.kind === "pdf" || a.kind === "word");
      if (textAttachments.length > 0) {
        const attachText = textAttachments.map(a => "[Arquivo: " + a.name + "]\n" + a.content).join("\n\n---\n\n");
        fullPrompt += "\n\n[Anexos]\n" + attachText;
      }
      const res = await fetch(APP_URL + "/functions/queryAI", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, models: selectedModels, apiKey: currentSettings.apiKey, imageBase64: imageAttachment }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
      setLastQuestion(prompt);
      // Build speed ranking (successful only, sorted by time)
      const ranked = Object.entries(data.results || {})
        .filter(([, r]) => r.response && !r.error && r.time)
        .sort((a, b) => (a[1].time || 0) - (b[1].time || 0))
        .map(([id]) => id);
      setSpeedRanking(ranked);
      if (data.gateway) setActiveGateway(data.gateway);
      setAttachments([]);

      // Save to history DB
      await ResearchHistory.create({
        question: prompt,
        context_profile: hasContext ? context : {},
        models_used: selectedModels,
        results: data.results,
        consolidated: "",
        gateway: data.gateway || "",
      });

      const firstSuccess = Object.values(data.results || {}).find(r => r.response && !r.error);
      if (firstSuccess) {
        const ans = firstSuccess.response.length > 500 ? firstSuccess.response.slice(0, 500) + "..." : firstSuccess.response;
        setChatHistory(prev => [...prev, { question: prompt, answer: ans }]);
      }
    } catch (err) { setError("Erro ao consultar: " + err.message); }
    finally { setLoading(false); }
  };

  const handleConsolidate = async () => {
    if (successfulResults.length === 0) return;
    setConsolidating(true); setShowConsolidated(true); setConsolidated("");
    const currentSettings = loadSettings();
    const responsesText = successfulResults.map(([id, r]) => { const m = MODELS.find((x) => x.id === id); return "### " + (m ? m.name : id) + "\n" + r.response; }).join("\n\n---\n\n");
    const consolidationPrompt = "Voce e um especialista em sintese de informacoes. Abaixo estao respostas de diferentes modelos de IA para a mesma pergunta.\n\nPERGUNTA ORIGINAL:\n" + lastQuestion + "\n\nRESPOSTAS:\n" + responsesText + "\n\nTAREFA: Analise e gere uma versao consolidada que combine os melhores pontos, resolva contradicoes, elimine redundancias e produza um texto coeso. Indique consensos e divergencias.";
    try {
      const res = await fetch(APP_URL + "/functions/queryAI", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: consolidationPrompt, models: [currentSettings.consolidationModel], apiKey: currentSettings.apiKey }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const r = data.results?.[currentSettings.consolidationModel];
      if (r?.error) throw new Error(r.error);
      const consolidatedText = r?.response || "Não foi possível gerar a consolidação.";
      setConsolidated(consolidatedText);
      // Update last history record with consolidated text
      try {
        const hist = await ResearchHistory.list({ sort: "-created_date", limit: 1 });
        if (hist[0]) await ResearchHistory.update(hist[0].id, { consolidated: consolidatedText });
      } catch {}
    } catch (err) { setConsolidated("Erro ao consolidar: " + err.message); }
    finally { setConsolidating(false); }
  };

  const handleExport = () => {
    const text = exportToTxt(lastQuestion, results, consolidated);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "jonasnetto-ia-" + new Date().toISOString().slice(0,10) + ".txt";
    a.click(); URL.revokeObjectURL(url);
    setExportDone(true); setTimeout(() => setExportDone(false), 2500);
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    setAttachLoading(true);
    const processed = await Promise.all(files.map(processFile));
    setAttachments(prev => [...prev, ...processed]);
    setAttachLoading(false); e.target.value = "";
  };

  const removeAttachment = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx));
  const handleKeyDown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleQuery(); };

  const inputStyle = { width: "100%", background: T.input, border: "1px solid " + T.inputBorder, borderRadius: 8, padding: "9px 12px", color: T.text, fontSize: "0.92rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const surfaceStyle = { background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 12, backdropFilter: T.isGlass ? "blur(12px)" : "none" };
  const cardStyle = () => ({ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 14, backdropFilter: T.cardBlur !== "none" ? T.cardBlur : "none", boxShadow: T.cardShadow, overflow: "hidden" });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", color: T.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}*{box-sizing:border-box}input::placeholder,textarea::placeholder{color:${T.textDim}}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.surfaceBorder};border-radius:99px}`}</style>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onThemeChange={(t) => setTheme(t)} />}
      {showHistoryModal && <HistoryModal T={T} onClose={() => setShowHistoryModal(false)} onRestore={(h) => { setPrompt(h.question); setResults(h.results || {}); setLastQuestion(h.question); setConsolidated(h.consolidated || ""); setShowConsolidated(!!h.consolidated); setSelectedModels(h.models_used || selectedModels); }} />}
      {showPromptsModal && <SavedPromptsModal T={T} currentPrompt={prompt} onClose={() => setShowPromptsModal(false)} onSelect={(t) => setPrompt(t)} />}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="https://media.base44.com/images/public/69bd9feba10b3ecf67510347/0a59cfd74_JN8.png" alt="JonasNetto IA" style={{ height: 44, width: "auto", filter: T.isLight ? "brightness(0) saturate(100%) invert(8%) sepia(82%) saturate(2700%) hue-rotate(218deg) brightness(90%) contrast(120%)" : "brightness(0) invert(1)" }} />
            <div>
              <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: T.isLight ? T.accent : "transparent", background: T.isLight ? "none" : T.headingGradient, WebkitBackgroundClip: T.isLight ? "none" : "text", WebkitTextFillColor: T.isLight ? T.accent : "transparent" }}>JonasNetto IA</h1>
              <p style={{ margin: 0, fontSize: "0.72rem", color: T.textDim }}>Consulte múltiplos modelos de IA em paralelo</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {gatewayInfo && <span style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: 999, background: T.pillActive(gatewayInfo.color), border: "1px solid " + T.pillBorder(gatewayInfo.color), color: gatewayInfo.color, fontWeight: 600 }}>{gatewayInfo.name}</span>}
            <button onClick={() => setShowHistoryModal(true)} style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 9, padding: "7px 14px", color: T.textMuted, cursor: "pointer", fontSize: "0.85rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>📚 Histórico</button>
            <button onClick={() => setShowSettings(true)} style={{ background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 9, padding: "7px 14px", color: T.textMuted, cursor: "pointer", fontSize: "0.85rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>⚙️ Config</button>
          </div>
        </div>

        {/* Model Selector */}
        <div style={{ ...surfaceStyle, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Modelos <em style={{ fontSize: "0.68rem", fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: "normal" }}>Models</em>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MODELS.map((m) => {
              const active = selectedModels.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleModel(m.id)} style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid " + (active ? T.pillBorder(m.color) : T.surfaceBorder), background: active ? T.pillActive(m.color) : "transparent", color: active ? m.color : T.textMuted, fontWeight: active ? 700 : 500, cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                  {m.icon} {m.name}
                  {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, display: "inline-block" }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Context Panel */}
        <div style={{ ...surfaceStyle, marginBottom: 14, overflow: "hidden" }}>
          <button onClick={() => setShowContext(!showContext)} style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", color: T.textMuted, fontSize: "0.85rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              📋 Perfil da Pesquisa <em style={{ fontSize: "0.72rem", fontWeight: 400, fontStyle: "italic", color: T.textDim, opacity: 0.8 }}>Research Profile</em>
              {hasContext && <span style={{ background: T.accent, color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: "0.7rem" }}>ativo</span>}
            </span>
            <span style={{ color: T.textDim }}>{showContext ? "▲" : "▼"}</span>
          </button>
          {showContext && (
            <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {CONTEXT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label style={{ display: "block", marginBottom: 5 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textDim, textTransform: "uppercase" }}>{f.label}</span>
                    <em style={{ display: "block", fontSize: "0.68rem", color: T.textDim, fontStyle: "italic", marginTop: 1, opacity: 0.75 }}>{f.labelEn}</em>
                  </label>
                  <input value={context[f.key]} onChange={(e) => setContext({ ...context, [f.key]: e.target.value })} placeholder={f.placeholder} style={inputStyle} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversation History Toggle */}
        <div style={{ ...surfaceStyle, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setUseHistory(!useHistory)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: useHistory ? T.accent : T.textMuted, fontWeight: 600, fontSize: "0.85rem", padding: 0 }}>
              <span style={{ width: 38, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", background: useHistory ? T.accent : T.surfaceBorder, transition: "background 0.2s", position: "relative", flexShrink: 0 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", left: useHistory ? 19 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </span>
              🕑 Continuar conversa <em style={{ fontSize: "0.78rem", fontWeight: 400, fontStyle: "italic", opacity: 0.75 }}>Continue conversation</em>
              {chatHistory.length > 0 && <span style={{ background: useHistory ? T.accent : T.surfaceBorder, color: useHistory ? "#fff" : T.textMuted, borderRadius: 999, padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700 }}>{chatHistory.length} troca{chatHistory.length !== 1 ? "s" : ""}</span>}
            </button>
            {chatHistory.length > 0 && <button onClick={() => { setChatHistory([]); setUseHistory(false); }} style={{ background: "none", border: "1px solid " + T.surfaceBorder, borderRadius: 6, cursor: "pointer", color: T.textDim, fontSize: "0.78rem", padding: "3px 10px" }}>🗑️ Limpar</button>}
          </div>
          {useHistory && chatHistory.length > 0 && (
            <div style={{ padding: "0 16px 16px", maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {chatHistory.map((h, i) => (
                <div key={i} style={{ background: T.isLight ? "#f9fafb" : "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem" }}>
                  <div style={{ color: T.accent, fontWeight: 700, marginBottom: 3 }}>❓ {h.question}</div>
                  <div style={{ color: T.textMuted, lineHeight: 1.5 }}>{h.answer}</div>
                </div>
              ))}
            </div>
          )}
          {useHistory && chatHistory.length === 0 && <div style={{ padding: "0 16px 14px", color: T.textDim, fontSize: "0.8rem" }}>Faça sua primeira pergunta — o histórico será acumulado automaticamente.</div>}
        </div>

        {/* Prompt */}
        <div style={{ ...surfaceStyle, padding: 16, marginBottom: 20 }}>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Digite sua pergunta... / Type your question... (Ctrl+Enter para enviar)"
            rows={4} style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: T.text, fontSize: "0.97rem", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.65 }} />

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {attachments.map((a, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.isLight ? "#f0f4ff" : "rgba(129,140,248,0.12)", border: "1px solid " + (T.isLight ? "#c7d2fe" : "rgba(129,140,248,0.3)"), borderRadius: 999, padding: "3px 10px", fontSize: "0.78rem", color: T.accent }}>
                  {a.kind === "image" ? "🖼️" : a.kind === "pdf" ? "📄" : a.kind === "word" ? "📝" : "📄"} {a.name}
                  <button onClick={() => removeAttachment(i)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, fontSize: "0.85rem", padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid " + T.surfaceBorder }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Attach */}
              <label title="Anexar arquivo / Attach file" style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 7, padding: "6px 12px", color: T.textMuted, fontSize: "0.82rem", fontWeight: 500 }}>
                {attachLoading ? <span style={{ width: 12, height: 12, border: "2px solid " + T.textDim, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> : "📎"}
                Anexar <em style={{ fontStyle: "italic", fontSize: "0.74rem", opacity: 0.75 }}>Attach</em>
                <input type="file" multiple accept=".txt,.pdf,.doc,.docx,image/*" onChange={handleFileSelect} style={{ display: "none" }} />
              </label>
              {/* Saved prompts */}
              <button onClick={() => setShowPromptsModal(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: T.surface, border: "1px solid " + T.surfaceBorder, borderRadius: 7, padding: "6px 12px", color: T.textMuted, fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>
                ⭐ Templates
              </button>
              <span style={{ color: T.textDim, fontSize: "0.76rem" }}>{selectedModels.length} modelo{selectedModels.length !== 1 ? "s" : ""} · Ctrl+Enter</span>
            </div>
            <button onClick={handleQuery} disabled={loading || (!prompt.trim() && attachments.length === 0)} style={{ background: loading ? T.surface : T.accent, color: loading ? T.textMuted : "#fff", border: "1px solid " + (loading ? T.surfaceBorder : "transparent"), borderRadius: 8, padding: "8px 22px", fontWeight: 600, fontSize: "0.88rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7 }}>
              {loading ? <><span style={{ width: 13, height: 13, border: "2px solid " + T.textDim, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Consultando... <em style={{ fontStyle: "italic", fontSize: "0.82rem", opacity: 0.8 }}>Querying...</em></> : "🚀 Perguntar / Ask"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div style={{ background: T.errorBg, border: "1px solid " + T.errorBorder, borderRadius: 10, padding: "11px 16px", color: T.errorText, marginBottom: 18, fontSize: "0.88rem" }}>⚠️ {error}</div>}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {selectedModels.map((id) => {
              const m = MODELS.find((x) => x.id === id);
              return (
                <div key={id} style={cardStyle()}>
                  <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid " + T.cardBorder, display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
                    <span style={{ fontWeight: 700, color: m.color, fontSize: "0.92rem" }}>{m.name}</span>
                    <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: m.color, animation: "pulse 1.2s ease-in-out infinite" }} />
                  </div>
                  <div style={{ padding: 18 }}>
                    {[80, 65, 90, 50].map((w, i) => <div key={i} style={{ height: 11, borderRadius: 6, background: T.skeleton, marginBottom: 10, width: w + "%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: (i * 0.1) + "s" }} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results */}
        {!loading && hasResults && (
          <>
            {/* Speed ranking bar */}
            {speedRanking.length > 0 && (
              <div style={{ ...surfaceStyle, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>⚡ Velocidade</span>
                {speedRanking.map((id, i) => {
                  const m = MODELS.find(x => x.id === id);
                  const r = results[id];
                  const medals = ["🥇","🥈","🥉"];
                  return (
                    <span key={id} style={{ display: "flex", alignItems: "center", gap: 5, background: m ? m.color + "12" : T.surface, border: "1px solid " + (m ? m.color + "33" : T.surfaceBorder), borderRadius: 999, padding: "3px 12px", fontSize: "0.78rem" }}>
                      <span>{medals[i] || (i+1)+"º"}</span>
                      <span style={{ fontWeight: 700, color: m ? m.color : T.text }}>{m ? m.icon + " " + m.name : id}</span>
                      <span style={{ color: i === 0 ? "#16a34a" : T.textMuted, fontWeight: i === 0 ? 700 : 400 }}>{r ? (r.time/1000).toFixed(1)+"s" : ""}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Export button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button onClick={handleExport} style={{ background: T.isLight ? "#f0fdf4" : "rgba(34,197,94,0.1)", border: "1px solid " + (T.isLight ? "#bbf7d0" : "rgba(34,197,94,0.25)"), borderRadius: 9, padding: "7px 16px", color: T.isLight ? "#16a34a" : "#4ade80", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {exportDone ? "✅ Exportado!" : "⬇️ Exportar TXT / Export"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}>
              {Object.entries(results).map(([id, r]) => {
                const m = MODELS.find((x) => x.id === id);
                return (
                  <div key={id} style={cardStyle()}>
                    <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid " + T.cardBorder, display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: "1.1rem" }}>{m ? m.icon : "🤖"}</span>
                      <span style={{ fontWeight: 700, color: m ? m.color : T.text, fontSize: "0.92rem" }}>{m ? m.name : id}</span>
                      {imageAttachment && ["openai","gemini","claude"].includes(id) && <span title="Vision ativo" style={{ fontSize: "0.68rem", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 999, padding: "1px 7px", color: "#818cf8", fontWeight: 600 }}>👁️ Vision</span>}
                      {r.time && (() => {
                        const rank = speedRanking.indexOf(id);
                        const medals = ["🥇","🥈","🥉"];
                        const medal = rank >= 0 && rank < 3 ? medals[rank] : null;
                        return (
                          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                            {medal && <span title={"#" + (rank+1) + " mais rápido"} style={{ fontSize: "0.88rem" }}>{medal}</span>}
                            <span style={{ color: rank === 0 ? "#16a34a" : rank === 1 ? "#ca8a04" : T.textDim, fontSize: "0.72rem", fontWeight: rank < 2 ? 700 : 400 }}>{(r.time / 1000).toFixed(1)}s</span>
                          </span>
                        );
                      })()}
                      {!r.error && r.response && <CopyButton text={r.response} T={T} />}
                    </div>
                    <div style={{ padding: 18 }}>
                      {r.error
                        ? <div style={{ color: T.errorText, fontSize: "0.85rem", background: T.errorBg, padding: "10px 14px", borderRadius: 8, border: "1px solid " + T.errorBorder }}>⚠️ {r.error}</div>
                        : <div style={{ color: T.text, fontSize: "0.88rem", lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: formatText(r.response, T.isLight) }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Consolidate button */}
            {successfulResults.length > 1 && (
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <button onClick={handleConsolidate} disabled={consolidating} style={{ background: T.isLight ? "#fffbeb" : T.consolidateBg, border: "1px solid " + T.consolidateBorder, borderRadius: 10, padding: "10px 28px", color: T.isLight ? "#92400e" : "#fbbf24", fontWeight: 700, fontSize: "0.88rem", cursor: consolidating ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {consolidating ? <><span style={{ width: 13, height: 13, border: "2px solid #fbbf24", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Consolidando... </> : "✨ Consolidar Respostas / Consolidate with " + consolidationModelInfo.icon + " " + consolidationModelInfo.name}
                </button>
              </div>
            )}

            {/* Consolidated result */}
            {showConsolidated && (
              <div style={{ background: T.consolidateBg, border: "1px solid " + T.consolidateBorder, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid " + T.consolidateBorder, display: "flex", alignItems: "center", gap: 9 }}>
                  <span>✨</span>
                  <span style={{ fontWeight: 700, color: T.isLight ? "#92400e" : "#fbbf24", fontSize: "0.92rem" }}>
                    Consolidação por <em style={{ fontWeight: 400, fontStyle: "italic", fontSize: "0.82rem", opacity: 0.85 }}>Consolidated by</em> {consolidationModelInfo.icon} {consolidationModelInfo.name}
                  </span>
                  {consolidated && !consolidating && <CopyButton text={consolidated} T={T} />}
                </div>
                <div style={{ padding: 18 }}>
                  {consolidating
                    ? <div style={{ display: "flex", gap: 8, alignItems: "center", color: T.textMuted, fontSize: "0.88rem" }}><span style={{ width: 13, height: 13, border: "2px solid " + T.textDim, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Analisando e consolidando...</div>
                    : <div style={{ color: T.text, fontSize: "0.88rem", lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: formatText(consolidated, T.isLight) }} />}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
