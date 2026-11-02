import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => http(...a) }));

import { packagesService } from "./packages.service";

describe("packagesService.upsertAll (P45)", () => {
  beforeEach(() => {
    http.mockReset();
    http.mockResolvedValue({ success: true });
  });

  it("pide el guardado atómico y no permite lista vacía por defecto", async () => {
    await packagesService.upsertAll(7, [{ peso: 2 }]);
    const [url, opts] = http.mock.calls[0];
    expect(url).toBe("/ajax_shipment_packages");
    expect(opts.body).toEqual({
      shipment_id: 7,
      packages: [{ peso: 2 }],
      atomic: true,
    });
  });

  it("solo acepta lista vacía cuando se quitaron todos los bultos", async () => {
    await packagesService.upsertAll(7, []);
    expect(http.mock.calls[0][1].body).toMatchObject({
      atomic: true,
      allow_empty: true,
    });
  });
});
