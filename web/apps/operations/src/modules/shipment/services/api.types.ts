/**
 * Re-export de los tipos de API compartido (@shared/services/api.types).
 * Mantiene el import path local que usan los consumidores de esta app,
 * mientras la implementación vive en packages/platform (fuente única, antes
 * forkeada byte-idéntica entre cargo/shipment).
 */
export * from "@shared/services/api.types";
