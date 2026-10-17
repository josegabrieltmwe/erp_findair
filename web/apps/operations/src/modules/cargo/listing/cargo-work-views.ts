import type { ListingWorkView } from "@shared/listing/types";

export const CARGO_WORK_VIEWS = [
  {
    id: "standard",
    labelKey: "listing.work_view.standard",
    columns: [
      "id",
      "cliente",
      "origin",
      "destination",
      "awb",
      "created",
      "flight",
      "packages",
      "weight",
      "status",
      "actions",
    ],
    bulkActions: ["control", "archive"],
  },
  {
    id: "tracking",
    labelKey: "listing.work_view.tracking",
    columns: [
      "id",
      "awb",
      "origin",
      "destination",
      "flight",
      "cliente",
      "status",
      "actions",
    ],
    bulkActions: ["control", "archive"],
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

export function cargoDefaultWorkView(listingType: string): string {
  if (listingType === "in_transit") return "tracking";
  return "standard";
}
