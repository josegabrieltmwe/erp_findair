/**
 * Shim: los stores de cargo importan `{ i18n }` de `@cargo/plugins/i18n` para
 * emitir toasts vía `i18n.global.t()`. En operations hay UNA sola instancia de
 * i18n (la del shell), así que reexportamos esa — cargo no crea la suya.
 */
export { i18n } from "@/plugins/i18n";
