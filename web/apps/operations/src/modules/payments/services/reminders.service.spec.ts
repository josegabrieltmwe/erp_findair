import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import {
  buildRunBody,
  canSendReminders,
  groupByClient,
  isDryRun,
  remindersApi,
  sendableIds,
  type ReminderItem,
} from "./reminders.service";

beforeEach(() => httpMock.mockReset());

const item = (p: Partial<ReminderItem>): ReminderItem => ({
  client_id: 1,
  rag_soc: "ACME",
  tipo: "AVV5",
  total: 100,
  action: "would_send",
  to: ["a@x.it"],
  ...p,
});

describe("groupByClient", () => {
  it("agrupa por cliente, suma importes y destinatarios", () => {
    const g = groupByClient([
      item({}),
      item({ tipo: "SOLL", total: "50.5", pec: "pec@x.it", would_block: true }),
      item({ client_id: 2, rag_soc: "B", action: "no_recipient", to: [] }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].total).toBe(150.5);
    expect(g[0].would_block).toBe(true);
    expect(g[0].recipients).toEqual(["a@x.it", "pec@x.it"]);
    expect(g[1].sendable).toBe(false);
    expect(sendableIds(g)).toEqual([1]);
  });
});

describe("envío", () => {
  it("solo con modo activo, selección y permiso", () => {
    expect(canSendReminders({ mode: "ACTIVO" }, 2, true)).toBe(true);
    expect(canSendReminders({ mode: "DRY_RUN" }, 2, true)).toBe(false);
    expect(canSendReminders({ mode: "ACTIVO" }, 0, true)).toBe(false);
    expect(canSendReminders({ mode: "ACTIVO" }, 1, false)).toBe(false);
    expect(canSendReminders(null, 1, true)).toBe(false);
  });
  it("sin ajustes se trata como prueba", () => {
    expect(isDryRun(null)).toBe(true);
    expect(isDryRun({ mode: "ACTIVO" })).toBe(false);
  });
  it("el cuerpo incluye la confirmación", () => {
    expect(buildRunBody("overdue", [3])).toEqual({
      confirm: true,
      phase: "overdue",
      client_ids: [3],
    });
  });
});

describe("remindersApi", () => {
  it("preview pide la fase", async () => {
    httpMock.mockResolvedValue({ success: true, data: { items: [] } });
    const r = await remindersApi.preview("notice");
    expect(httpMock.mock.calls[0][1].query).toEqual({ phase: "notice" });
    expect(r).toEqual({ items: [], totals: {}, warnings: [] });
  });
  it("run hace un único POST con op=run", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: { totals: { sent: 2 } },
    });
    const r = await remindersApi.run("all", [1, 2]);
    expect(httpMock).toHaveBeenCalledTimes(1);
    expect(httpMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      query: { op: "run" },
      body: { confirm: true, phase: "all", client_ids: [1, 2] },
    });
    expect(r.totals.sent).toBe(2);
  });
});
