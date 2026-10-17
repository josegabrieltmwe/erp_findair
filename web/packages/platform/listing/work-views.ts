import type { DataTableHeader, ListingWorkView } from "./types";

export function isWorkViewCompatible(
  view: ListingWorkView,
  listingType: string,
): boolean {
  return (
    !view.compatibleTypes?.length || view.compatibleTypes.includes(listingType)
  );
}

export function resolveWorkView(
  views: readonly ListingWorkView[],
  requestedId: unknown,
  listingType: string,
  defaultId = "standard",
): ListingWorkView {
  if (views.length === 0) {
    throw new Error("At least one listing work view is required");
  }

  const rawId = Array.isArray(requestedId) ? requestedId[0] : requestedId;
  const requested = views.find(
    (view) => view.id === rawId && isWorkViewCompatible(view, listingType),
  );
  if (requested) return requested;

  const preferredDefault = views.find(
    (view) => view.id === defaultId && isWorkViewCompatible(view, listingType),
  );
  if (preferredDefault) return preferredDefault;

  const compatible = views.find((view) =>
    isWorkViewCompatible(view, listingType),
  );
  return compatible ?? views[0];
}

export function headersForWorkView(
  headers: readonly DataTableHeader[],
  view: ListingWorkView,
): DataTableHeader[] {
  const byKey = new Map(headers.map((header) => [header.key, header]));
  return view.columns.flatMap((key) => {
    const header = byKey.get(key);
    return header ? [header] : [];
  });
}
