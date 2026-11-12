import type { ListingWorkView } from "@shared/listing/types";

export const SHIPMENT_WORK_VIEWS = [
  {
    id: "standard",
    labelKey: "listing.work_view.standard",
    columns: [
      "id",
      "cliente",
      "awb",
      "origin",
      "destination",
      "created",
      "packages",
      "weight",
      "status",
      "actions",
    ],
    bulkActions: ["tracking", "control", "archive"],
  },
  {
    id: "tracking",
    labelKey: "listing.work_view.tracking",
    columns: [
      "id",
      "awb",
      "destination",
      "created",
      "cliente",
      "status",
      "actions",
    ],
    bulkActions: ["tracking", "control", "archive"],
    suggestedBulkAction: "tracking",
  },
  {
    id: "control",
    labelKey: "listing.work_view.control",
    columns: [
      "id",
      "cliente",
      "origin",
      "destination",
      "packages",
      "weight",
      "status",
      "actions",
    ],
    bulkActions: ["control", "archive"],
    suggestedBulkAction: "control",
  },
] as const satisfies readonly ListingWorkView[];

export function shipmentDefaultWorkView(listingType: string): string {
  if (listingType === "in_transit") return "tracking";
  return "standard";
}

/**
 * Cola de trabajo con la que se abre el listado para el personal TMWE (equivale al `dacontr` del legado:
 * las expediciones propias aún sin controlar). Debe ser un tipo que `normalisedType` acepte (clave del
 * catálogo KPI de la home); un test lo comprueba.
 */
export const DEFAULT_SHIPMENT_QUEUE = "dacontr";
