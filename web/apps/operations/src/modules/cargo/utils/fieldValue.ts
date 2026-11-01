/**
 * Valor de un campo de Vuetify. El evento nativo `change` de v-text-field / v-textarea trae un Event,
 * no el valor: tratarlo como string enviaba `{"isTrusted":true,...}` al API y guardaba «Array».
 */
export function fieldValue(e: Event | string | null | undefined): string {
  if (typeof e === "string") return e;
  const t = e?.target as { value?: unknown } | null | undefined;
  return t?.value == null ? "" : String(t.value);
}
