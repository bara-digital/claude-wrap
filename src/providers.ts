// Curated catalog of known LLM backends for the onboarding wizard.
// Each entry pre-fills base_url / model / auth so users can pick + paste a key
// instead of memorizing endpoint + model strings. See src/setup.ts (runSetup).

export type AuthKind = "login" | "api_key" | "auth_token" | "none";

export interface ProviderCatalogEntry {
  /** slug; also the default preset name */
  id: string;
  /** label shown in the picker */
  label: string;
  /** one-line description shown as a hint */
  hint: string;
  /** default base_url (empty for `custom`, which prompts) */
  baseUrl: string;
  /** pre-filled model (user-editable) */
  defaultModel?: string;
  /** how the preset authenticates */
  authKind: AuthKind;
  /** $VAR reference name when authKind is api_key / auth_token */
  envVar?: string;
  /** true → the wizard prompts for base_url (the "Custom" entry) */
  needsBaseUrl?: boolean;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "anthropic",
    label: "Anthropic (subscription / OAuth)",
    hint: "Uses `claude login` — no API key needed",
    baseUrl: "https://api.anthropic.com/v1",
    authKind: "login",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    hint: "Anthropic-compatible API",
    baseUrl: "https://api.deepseek.com/anthropic",
    defaultModel: "deepseek-chat",
    authKind: "api_key",
    envVar: "DEEPSEEK_API_KEY",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "300+ models, OpenAI-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.7-sonnet",
    authKind: "api_key",
    envVar: "OPENROUTER_API_KEY",
  },
  {
    id: "groq",
    label: "Groq (via LiteLLM proxy)",
    hint: "Local proxy at http://localhost:4000",
    baseUrl: "http://localhost:4000/v1",
    defaultModel: "groq/llama-3.3-70b-versatile",
    authKind: "api_key",
    envVar: "GROQ_API_KEY",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    hint: "No auth, local models",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "ollama/llama3",
    authKind: "none",
  },
  {
    id: "custom",
    label: "Custom / other gateway",
    hint: "I'll type the base URL myself",
    baseUrl: "",
    authKind: "api_key",
    needsBaseUrl: true,
  },
];

export function findProvider(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}
