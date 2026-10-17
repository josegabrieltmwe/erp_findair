import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import {
  rateSourcesService,
  type QuoteDataIssue,
  type QuoteDataValidation,
} from "@cargo/services/rate_sources.service";

/**
 * «¿Se puede buscar vuelos para este envío?», compartido por todas las
 * entradas a la búsqueda.
 *
 * El guard vive aquí y no en cada botón porque hay VARIAS puertas al mismo
 * modal (la tarjeta de vuelo, el detalle del rate, el box de vettori del modal
 * de servicio) y cada una que se olvide del guard es una puerta de atrás por la
 * que se llega al formulario con datos incotizables y el botón de buscar
 * muerto sin explicación.
 *
 * La respuesta la da `Cargo_Quote_Data_Validator` en el backend, que es EL
 * MISMO que decide el 422 del endpoint de búsqueda: así el diálogo no puede
 * desincronizarse de lo que realmente bloquea, y mira el detalle de bultos —
 * no solo el peso de cabecera, que era lo único que comprobaba el guard viejo.
 */
export function useQuoteGuard() {
  const cargoStore = useCargoStore();
  const ui = useUiStore();
  const { cargo, id: cargoId } = storeToRefs(cargoStore);

  const issues = ref<QuoteDataIssue[]>([]);
  const checking = ref(false);
  const blockedOpen = ref(false);

  /** Consulta la validación. `null` si no se pudo resolver. */
  async function fetchValidation(): Promise<QuoteDataValidation | null> {
    if (!cargoId.value) return null;
    const c = cargo.value as {
      terminal_part?: string | null;
      terminal_dest?: string | null;
    } | null;
    try {
      const res = await rateSourcesService.forRoute({
        origin: c?.terminal_part ?? "",
        destination: c?.terminal_dest ?? "",
        shipmentId: Number(cargoId.value),
      });
      return res.validation ?? null;
    } catch {
      // Fail-OPEN a propósito: si la validación no se puede consultar (red,
      // 500) no se le puede negar la búsqueda al operador por una comprobación
      // previa que es una cortesía. El backend conserva la última palabra con
      // su 422, que es la barrera real.
      return null;
    }
  }

  /**
   * Abre la búsqueda, o el diálogo de bloqueo si el envío no es cotizable.
   */
  async function openSearch(): Promise<void> {
    checking.value = true;
    try {
      const validation = await fetchValidation();
      if (validation && !validation.valid) {
        issues.value = validation.issues ?? [];
        blockedOpen.value = true;
        return;
      }
      ui.openModal("flight_search");
    } finally {
      checking.value = false;
    }
  }

  /** Reintento desde el diálogo, tras arreglar los datos. */
  async function recheck(): Promise<void> {
    checking.value = true;
    try {
      // Relee el cargo primero: los datos se arreglan en otro modal y el row
      // local seguiría con los valores viejos, así que la revalidación diría
      // que sigue bloqueado aunque ya no lo esté.
      if (cargoId.value) await cargoStore.load(Number(cargoId.value));
      const validation = await fetchValidation();
      if (validation && !validation.valid) {
        issues.value = validation.issues ?? [];
        return;
      }
      blockedOpen.value = false;
      ui.openModal("flight_search");
    } finally {
      checking.value = false;
    }
  }

  /** Salta al modal donde se corrige el problema. */
  function goFix(modal: "colli" | "servizio"): void {
    blockedOpen.value = false;
    ui.openModal(modal);
  }

  return { issues, checking, blockedOpen, openSearch, recheck, goFix };
}
