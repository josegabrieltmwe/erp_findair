/**
 * Re-export del toast store compartido (@shared/stores/toast.store).
 * Mantiene el import path `@/stores/toast.store` que usan los consumidores de
 * esta app, mientras la implementación vive en packages/platform (fuente única).
 */
export * from "@shared/stores/toast.store";
