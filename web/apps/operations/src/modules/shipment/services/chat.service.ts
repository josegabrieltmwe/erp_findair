/**
 * Re-export del chat service compartido (@shared/services/chat.service).
 * Mantiene el import path `@/services/chat.service` que usan los consumidores
 * de esta app, mientras la implementación vive en packages/platform (fuente
 * única, antes forkeada byte-idéntica entre cargo/shipment).
 */
export * from "@shared/services/chat.service";
