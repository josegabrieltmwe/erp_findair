/**
 * Re-export del geo service compartido (@shared/services/geo.service).
 * Mantiene el import path local que usan los consumidores de esta app,
 * mientras la implementación vive en packages/platform (fuente única, antes
 * forkeada byte-idéntica entre cargo/shipment).
 */
export * from "@shared/services/geo.service";
