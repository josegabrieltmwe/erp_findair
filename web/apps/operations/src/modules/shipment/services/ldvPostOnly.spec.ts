import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => http(...a) }));

import { ldvService } from "./ldv.service";
import { labelsService } from "./labels.service";

/**
 * Collaudo 13/11 (S1): «Invia LDV al mittente» llamaba con GET. El backend
 * (Send_Ldv_To_Mittente_Compat_Controller) y el BFF solo aceptan POST, asi que
 * el boton devolvia 405. Los dos servicios que la consumen deben usar POST.
 */
describe("envio de la LDV al remitente: solo POST", () => {
  beforeEach(() => {
    http.mockReset();
    http.mockResolvedValue({ success: true });
  });

  it("ldvService.sendToMittente usa POST con el body", async () => {
    await ldvService.sendToMittente(1001, "otp-1");
    const [url, opts] = http.mock.calls[0];
    expect(url).toBe("/api_send_ldv_to_mittente_compat");
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual({ shipment_id: 1001, otp: "otp-1" });
    expect(opts.query).toBeUndefined();
  });

  it("labelsService.sendLdvToMittente usa POST con el body", async () => {
    await labelsService.sendLdvToMittente(1002);
    const [url, opts] = http.mock.calls[0];
    expect(url).toBe("/api_send_ldv_to_mittente_compat");
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual({ shipment_id: 1002 });
    expect(opts.query).toBeUndefined();
  });
});
