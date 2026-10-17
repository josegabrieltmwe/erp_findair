/**
 * Rubrica (address book) REST client para cargo_express.
 *
 * Paridad legacy: el campo `anagr_cerca_*` de spedyc_form.php (L489, L517,
 * L541) — los tres bloques de dirección de cargo (destino, presa y agenzia
 * doganale) tienen buscador de rubrica, igual que courier.
 *
 * La implementación vive en `@shared/anagrafiche/services/rubrica.service`;
 * aquí solo se enlaza con el http de esta app, que resuelve su basePath
 * desde `__TMWE_CARGO__`.
 */
import { createRubricaService } from "@shared/anagrafiche/services/rubrica.service";
import { http } from "./http";

export type {
  RubricaRow,
  RubricaSearchParams,
} from "@shared/anagrafiche/services/rubrica.service";

export const rubricaService = createRubricaService(http);
