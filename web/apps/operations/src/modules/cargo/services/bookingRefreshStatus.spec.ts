import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => http(...a) }));

import { bookingService } from "./booking.service";

/**
 * Collaudo 13/11 (S2): «Aggiorna stato» llamaba por GET, el controlador
 * respondia 405 y el catch lo tragaba: el estado no se actualizaba y nadie lo
 * veia. Ahora POST, y un fallo llega al llamador (que muestra un aviso).
 */
describe("bookingService.refreshStatus", () => {
  beforeEach(() => {
    http.mockReset();
  });

  it("usa POST con el booking_id en el body", async () => {
    http.mockResolvedValue({ success: true, booking: { status: "CONFIRMED" } });
    const r = await bookingService.refreshStatus("wc_book_1");
    const [url, opts] = http.mock.calls[0];
    expect(url).toBe("/api_cargo_webcargo_booking_status");
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual({ booking_id: "wc_book_1" });
    expect(opts.query).toBeUndefined();
    expect(r).toEqual({ status: "CONFIRMED" });
  });

  it("propaga el error en lugar de tragarlo", async () => {
    http.mockRejectedValue(new Error("405"));
    await expect(bookingService.refreshStatus("wc_book_1")).rejects.toThrow("405");
  });
});
