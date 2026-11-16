import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => http(...a) }));

import { serviceSelectionService } from "./service_selection.service";

describe("serviceSelectionService.listClient: options.tempi_certi", () => {
  beforeEach(() => {
    http.mockReset();
    http.mockResolvedValue({ success: true });
  });

  it("no envía tempi_certi salvo que se pida", async () => {
    await serviceSelectionService.listClient(5, { include_unavailable: true });
    const body = http.mock.calls[0][1].body;
    expect(body.options).not.toHaveProperty("tempi_certi");
  });

  it("envía options.tempi_certi=true cuando se pide", async () => {
    await serviceSelectionService.listClient(5, { tempi_certi: true });
    const [path, init] = http.mock.calls[0];
    expect(path).toBe("/unified_express_service_list_by_shipment");
    expect(init.body.shipment_id).toBe(5);
    expect(init.body.options.tempi_certi).toBe(true);
  });
});
