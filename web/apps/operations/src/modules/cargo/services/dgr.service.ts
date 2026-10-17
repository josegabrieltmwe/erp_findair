/**
 * DGR service (cargo aéreo, is_cargo='S').
 *
 * Implementación única en @shared/services/dgr.service, compartida con
 * shipment_express (que la liga a 'N'). Aquí se liga al modo cargo ('S'),
 * de modo que las declaraciones persisten con is_cargo='S' (spedizioni_cargo)
 * y el backend aplica el default regulation_set='IATA'.
 */
import { createDgrService } from "@shared/services/dgr.service";

export type {
  DgrSubstance,
  DgrTransportMode,
  DgrDeclaration,
} from "@shared/services/dgr.service";

/** API estable consumida por los componentes DGR de cargo (is_cargo='S'). */
export const dgrService = createDgrService("S");
