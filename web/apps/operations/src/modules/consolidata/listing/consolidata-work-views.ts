import type { ListingWorkView } from "@shared/listing/types";

/**
 * Vistas de trabajo del listado de proyectos (plan §4.3). Las claves de
 * columna son las de `allHeaders` en ConsolidataListPage.vue.
 */
export const CONSOLIDATA_WORK_VIEWS = [
  {
    id: "standard",
    labelKey: "consolidata.list.work_view.standard",
    columns: [
      "id",
      "titolo",
      "cliente",
      "tipo",
      "ruta",
      "n_spedizioni",
      "totale",
      "stato",
      "assegnato",
      "modif_datetime",
      "actions",
    ],
    bulkActions: ["assign"],
  },
  {
    id: "gestion",
    labelKey: "consolidata.list.work_view.gestion",
    columns: [
      "id",
      "cliente",
      "stato",
      "assegnato",
      "antiguedad",
      "risposta",
      "actions",
    ],
    bulkActions: ["assign"],
    suggestedBulkAction: "assign",
  },
  {
    id: "operativa",
    labelKey: "consolidata.list.work_view.operativa",
    columns: [
      "id",
      "cliente",
      "ruta",
      "peso",
      "cargo",
      "conversione",
      "insert_datetime",
      "actions",
    ],
    bulkActions: [],
  },
] as const satisfies readonly ListingWorkView[];

export function consolidataDefaultWorkView(): string {
  return "standard";
}
