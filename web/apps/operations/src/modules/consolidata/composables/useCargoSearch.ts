import { ref } from "vue";
import { cargoListService } from "@cargo/services/cargo.service";

export interface CargoItem {
  id: number;
  label: string;
}

/**
 * Buscador de cargos (MAWB) para enlazar o para `operate` con un cargo
 * existente. Lo comparten el diálogo de `convert` y la pestaña Conversión.
 */
export function useCargoSearch() {
  const items = ref<CargoItem[]>([]);
  const searching = ref(false);
  const selected = ref<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function toItem(row: {
    id: number;
    awb?: unknown;
    cliente?: unknown;
  }): CargoItem {
    const awb = typeof row.awb === "string" && row.awb ? ` · ${row.awb}` : "";
    const cli =
      typeof row.cliente === "string" && row.cliente ? ` · ${row.cliente}` : "";
    return { id: Number(row.id), label: `#${row.id}${awb}${cli}` };
  }

  async function search(q: string): Promise<void> {
    searching.value = true;
    try {
      const r = await cargoListService.fetch({
        search: q,
        per_page: 15,
        page: 1,
        type: "all",
      });
      const found = (r.data ?? []).map(toItem);
      // El cargo ya elegido debe seguir en la lista aunque la búsqueda lo excluya.
      const keep = items.value.filter(
        (i) => i.id === selected.value && !found.some((f) => f.id === i.id),
      );
      items.value = [...keep, ...found];
    } catch {
      // El cliente HTTP ya informa del error; la lista queda como estaba.
    } finally {
      searching.value = false;
    }
  }

  function onSearch(q: string | null): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void search(q ?? ""), 250);
  }

  /** Reinicia con un cargo preseleccionado (o ninguno) y lanza la primera búsqueda. */
  function reset(initial: number | null): void {
    selected.value = initial;
    items.value = initial ? [{ id: initial, label: `#${initial}` }] : [];
    void search("");
  }

  return { items, searching, selected, onSearch, reset };
}
