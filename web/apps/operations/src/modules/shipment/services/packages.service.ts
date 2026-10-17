import { http } from "./http";
import type { ShipmentPackage } from "./shipment.types";

export interface PackagesUpsertResult {
  success: boolean;
  packages?: ShipmentPackage[];
  error?: string;
}

/**
 * Row payload accepted by the packages upsert. Weights/dimensions are numeric
 * (metric); the backend coerces to the spedizioni_colli column types. Kept
 * loose (string|number) so both the editable ColliRow (numbers) and legacy
 * Partial<ShipmentPackage> (strings) callers type-check.
 */
export type PackageUpsertRow = {
  id?: number | string;
  n_collo?: number;
  segnac_cliente?: string;
  peso?: number | string;
  dim_a?: number | string;
  dim_l?: number | string;
  dim_p?: number | string;
  [k: string]: unknown;
};

export const packagesService = {
  /** ajax_shipment_packages POST — replace/merge packages for the shipment. */
  upsertAll(
    shipment_id: number,
    packages: PackageUpsertRow[],
  ): Promise<PackagesUpsertResult> {
    return http<PackagesUpsertResult>("/ajax_shipment_packages", {
      method: "POST",
      body: { shipment_id, packages },
    });
  },

  /** shipment_package_field — update one field of one package (used by inline edits). */
  updateField(
    package_id: number,
    field: keyof ShipmentPackage,
    value: unknown,
  ): Promise<{ success: boolean; error?: string }> {
    return http("/shipment_package_field", {
      method: "POST",
      body: { package_id, field, value },
    });
  },
};
