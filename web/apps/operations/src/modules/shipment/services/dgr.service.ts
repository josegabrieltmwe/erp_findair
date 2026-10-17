/**
 * DGR service (courier express, is_cargo='N').
 *
 * Implementación única en @shared/services/dgr.service (antes local a esta app).
 * Se liga al modo express vía createDgrService('N'); cargo_express hace lo mismo
 * con 'S'. Tipos re-exportados para no duplicarlos.
 */
import { createDgrService } from "@shared/services/dgr.service";

export type {
  DgrSubstance,
  DgrTransportMode,
  DgrDeclaration,
} from "@shared/services/dgr.service";

/** API estable consumida por los componentes DGR de courier (is_cargo='N'). */
export const dgrService = createDgrService("N");
