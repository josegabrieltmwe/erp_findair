/**
 * Re-export del composable de polling de chat compartido (@shared/composables/useChatRealtime).
 * Mantiene el import path local que usan los consumidores de esta app,
 * mientras la implementación vive en packages/platform (fuente única, antes
 * forkeada byte-idéntica entre cargo/shipment).
 */
export * from "@shared/composables/useChatRealtime";
