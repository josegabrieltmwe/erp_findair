import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => http(...a) }));

import { selectablePartnersService } from "./selectable_partners.service";

describe("selectablePartnersService", () => {
  beforeEach(() => http.mockReset());

  it("pide todos los tipo P por defecto y devuelve la marca ERP", async () => {
    http.mockResolvedValue({
      data: {
        partners: [
          { id: 1, label: "A", erp_partner: true },
          { id: 2, label: "B", erp_partner: false },
        ],
        count: 2,
      },
    });
    const r = await selectablePartnersService.search("ab");
    expect(http).toHaveBeenCalledWith("/api_selectable_partners", {
      query: { search: "ab", limit: "30", scope: "all" },
    });
    expect(r.map((p) => p.erp_partner)).toEqual([true, false]);
  });

  it("permite limitar a los ERP", async () => {
    http.mockResolvedValue({ data: { partners: [], count: 0 } });
    await selectablePartnersService.search("", 10, "erp");
    expect(http).toHaveBeenCalledWith("/api_selectable_partners", {
      query: { search: "", limit: "10", scope: "erp" },
    });
  });
});
