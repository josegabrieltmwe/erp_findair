/**
 * Rubrica (address book) REST client para shipment_express.
 *
 * La implementación vive en `@shared/anagrafiche/services/rubrica.service`
 * (fuente única compartida con cargo_express); aquí solo se enlaza con el
 * http de esta app, que resuelve su basePath desde `__TMWE_SHIPMENT__`.
 * Los consumidores siguen importando `{ rubricaService, type RubricaRow }`
 * desde este módulo.
 */
import { createRubricaService } from "@shared/anagrafiche/services/rubrica.service";
import { http } from "./http";

export type {
  RubricaRow,
  RubricaSearchParams,
} from "@shared/anagrafiche/services/rubrica.service";

export const rubricaService = createRubricaService(http);
