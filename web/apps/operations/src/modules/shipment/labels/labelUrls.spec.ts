import { describe, expect, it } from "vitest";
import { courierCombinedPdfUrl, courierCombinedZipUrl, tmweBundleUrl } from "./labelUrls";

describe("labelUrls", () => {
  it("LDV: todos los bultos no manda packages", () => {
    expect(
      tmweBundleUrl("/bff/v1", 55, { packages: null, format: "pdf" }),
    ).toBe("/bff/v1/api_label_tmwe_bundle?shipment_id=55&bundle=pdf");
  });
  it("LDV: selección e inline", () => {
    expect(
      tmweBundleUrl(
        "/bff/v1/",
        55,
        { packages: [1, 2, 3, 8], format: "zip" },
        true,
      ),
    ).toBe(
      "/bff/v1/api_label_tmwe_bundle?shipment_id=55&bundle=zip&packages=1-3%2C8&disposition=inline",
    );
  });
  it("courier: PDF combinado con selección", () => {
    expect(courierCombinedPdfUrl("/bff/v1", 9, [2], true)).toBe(
      "/bff/v1/api_label_combined_pdf?shipment_id=9&packages=2&disposition=inline",
    );
    expect(courierCombinedPdfUrl("/bff/v1", 9, null)).toBe(
      "/bff/v1/api_label_combined_pdf?shipment_id=9",
    );
  });

  it("courierCombinedZipUrl: todos los bultos o una selección", () => {
    expect(courierCombinedZipUrl("/bff/v1/", 55, null)).toBe(
      "/bff/v1/api_label_combined_zip?shipment_id=55",
    );
    expect(courierCombinedZipUrl("/bff/v1", 55, [1, 2, 3, 8])).toBe(
      "/bff/v1/api_label_combined_zip?shipment_id=55&packages=1-3%2C8",
    );
  });
});
