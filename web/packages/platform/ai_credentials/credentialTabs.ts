/** Pestañas de credenciales de IA: LLM (OpenAI/Anthropic) y Voz (ElevenLabs). */
export const CREDENTIAL_TABS = ['llm', 'voice'] as const;
export type CredentialTab = (typeof CREDENTIAL_TABS)[number];

/** Pestaña pedida (cadena o primer valor de un array) o `llm` por defecto. */
export function resolveCredentialTab(requested: unknown): CredentialTab {
  const r = Array.isArray(requested) ? requested[0] : requested;
  return CREDENTIAL_TABS.find((t) => t === r) ?? 'llm';
}
