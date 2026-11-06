import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => http(...a) }));

import { cargoOffersService } from "./cargo_offers.service";

describe("cargo_offers.service · distribute informa el callback_url", () => {
  beforeEach(() => {
    http.mockReset();
    vi.stubGlobal("window", { location: { origin: "https://sandbox.erp.findair.it" } });
  });

  it("añade la pantalla de la aerolínea de ESTA aplicación", async () => {
    http.mockResolvedValue({ success: true });
    await cargoOffersService.distribute({ cargo_id: 1, carriers: ["KL"] });
    const body = http.mock.calls[0][1].body;
    expect(body.action).toBe("distribute");
    expect(body.callback_url).toBe("https://sandbox.erp.findair.it/offer");
  });

  it("respeta un callback_url explícito", async () => {
    http.mockResolvedValue({ success: true });
    await cargoOffersService.distribute({ cargo_id: 1, carriers: ["KL"], callback_url: "https://x.example/o" });
    expect(http.mock.calls[0][1].body.callback_url).toBe("https://x.example/o");
  });
});
