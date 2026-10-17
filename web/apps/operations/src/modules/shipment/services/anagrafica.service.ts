/**
 * Re-export del anagrafica service compartido (@shared/services/anagrafica.service).
 * Mantiene el import path local que usan los consumidores de esta app,
 * mientras la implementación vive en packages/platform (fuente única, antes
 * forkeada byte-idéntica entre cargo/shipment).
 */
export * from "@shared/services/anagrafica.service";
