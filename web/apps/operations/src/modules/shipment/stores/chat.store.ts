/**
 * Re-export del chat store compartido (@shared/stores/chat.store).
 * Mantiene el import path local que usan los consumidores de esta app,
 * mientras la implementación vive en packages/platform (fuente única, antes
 * forkeada byte-idéntica entre cargo/shipment).
 */
export * from "@shared/stores/chat.store";
