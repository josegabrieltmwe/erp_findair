import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * N24 (collaudo): crear un avance de pratica NO debe avisar al cliente por
 * email salvo que el operador lo decida explícitamente con el interruptor
 * "Avisar al cliente" de CrmEventiSection.vue (apagado por defecto).
 *
 * Este spec cubre la capa de servicio: `crmService.addEvent` debe mandar
 * SIEMPRE el campo `notify_customer` como booleano explícito en el body de
 * `POST /api_crm_events` — true cuando el operador marca el interruptor,
 * false en caso contrario (incluido el valor por defecto si se omite el
 * argumento). `notify_customer` es el nombre más razonable dado el contexto
 * (N24) pero el parámetro real lo añade en paralelo otro agente en
 * `api_crm_events` (rama fix/n24-crm-notify-toggle-api, repo `api`, nombre
 * aún no confirmado): si difiere, reconciliar aquí y en crm.service.ts.
 */
const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let replies: unknown[] = [];

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return replies.length > 1 ? replies.shift() : replies[0];
  }),
}));

import { crmService } from "./crm.service";

beforeEach(() => {
  calls.length = 0;
  replies = [{ success: true, data: { id: 1, id_crm: 10 } }];
});

describe("crmService.addEvent: payload de notify_customer", () => {
  it("manda notify_customer: true cuando el operador marca el interruptor", async () => {
    await crmService.addEvent(10, "Llamada al cliente", "A", true);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api_crm_events");
    expect(calls[0].opts).toMatchObject({
      method: "POST",
      body: {
        id_crm: 10,
        descriz: "Llamada al cliente",
        stato_pratica: "A",
        notify_customer: true,
      },
    });
  });

  it("manda notify_customer: false cuando el interruptor está apagado", async () => {
    await crmService.addEvent(10, "Nota interna", "A", false);

    expect(calls[0].opts).toMatchObject({
      body: { notify_customer: false },
    });
  });

  it("por defecto (sin pasar el argumento) manda notify_customer: false", async () => {
    await crmService.addEvent(10, "Nota interna", "A");

    expect(calls[0].opts).toMatchObject({
      body: { notify_customer: false },
    });
  });
});
