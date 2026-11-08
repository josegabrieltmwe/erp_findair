import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ASYNC_SEARCH,
  openFlightSearchStream,
  type FlightSearchEvent,
} from "@cargo/services/flight_search.service";

/**
 * Búsqueda de vuelos asíncrona: inicio (202 search_id) y eventos leídos por
 * cursor con peticiones cortas, con los mismos eventos que el stream.
 * api/docs/03-diseno/cargo_rate_latencia/PLAN_BUSQUEDA_ASINCRONA.md
 */
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Call = { url: string; method: string; body?: string };

function apiStub(pages: Array<Record<string, unknown>>, start: Response = json(202, { success: true, data: { search_id: 77 } })) {
  const calls: Call[] = [];
  let page = 0;
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body as string | undefined });
    if (String(url).includes("api_cargo_rate_search_events")) {
      return json(200, { success: true, data: pages[Math.min(page++, pages.length - 1)] });
    }
    if (String(url).includes("api_cargo_rate_search_cancel")) return json(200, { success: true });
    if (String(url).includes("api_cargo_rate_search")) return start;
    throw new Error("unexpected " + url);
  });
  return { fn, calls };
}

function collect(until: (e: FlightSearchEvent) => boolean) {
  const events: FlightSearchEvent[] = [];
  let done!: () => void;
  const finished = new Promise<void>((r) => (done = r));
  const handle = openFlightSearchStream({ shipment_id: 9, weight: 120 }, (e) => {
    events.push(e);
    if (until(e)) done();
  });
  return { events, finished, handle };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("búsqueda de vuelos asíncrona", () => {
  it("lee los eventos desde el cursor y los normaliza como el stream", async () => {
    const { fn, calls } = apiStub([
      {
        status: "running", done: false, cursor: 2, poll_after_ms: 0,
        events: [
          { seq: 1, event: "permissions", data: { can_see_costs: true } },
          { seq: 2, event: "rate", data: { airline: "LH", source: "realtime", rates: [{ short_id: "a" }] } },
        ],
      },
      {
        status: "running", done: false, cursor: 4, poll_after_ms: 0,
        events: [
          { seq: 3, event: "complete", data: { total_rates: 1, late_pending: true } },
          { seq: 4, event: "late_rate", data: { airline: "EK", source: "realtime", rates: [{ short_id: "b" }] } },
        ],
      },
      { status: "done", done: true, cursor: 5, events: [{ seq: 5, event: "late_done", data: { timed_out: false } }] },
    ]);
    vi.stubGlobal("fetch", fn);

    const { events, finished } = collect((e) => e.type === "late_done");
    await finished;

    expect(events.map((e) => e.type)).toEqual(["permissions", "rate", "complete", "rate", "late_done"]);
    expect(calls[0].url).toContain("/bff/v1/api_cargo_rate_search");
    expect(JSON.parse(calls[0].body ?? "{}")).toMatchObject({ shipment_id: 9, override_weight: 120 });
    const polls = calls.filter((c) => c.url.includes("_events")).map((c) => new URL(c.url, "http://x").searchParams.get("since"));
    expect(polls).toEqual(["0", "2", "4"]);
  });

  it("con 503 abre el stream de siempre", async () => {
    const enc = new TextEncoder();
    const fn = vi.fn(async (url: string) => {
      if (String(url).includes("api_cargo_rate_search")) return json(503, { success: false, error: { code: "ASYNC_SEARCH_UNAVAILABLE" } });
      return new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(enc.encode('event: complete\ndata: {"total_rates":0}\n\n'));
            c.close();
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fn);

    const { events, finished } = collect((e) => e.type === "complete");
    await finished;
    expect(events.map((e) => e.type)).toEqual(["complete"]);
    expect(String(fn.mock.calls[1][0])).toContain("api_cargo_shipment_flight_search");
  });

  it("un error de validación al encargar llega como evento error", async () => {
    const { fn } = apiStub([], json(422, { success: false, error: { code: "INVALID_SHIPMENT_DATA", message: "shipment data is not valid for quoting" } }));
    vi.stubGlobal("fetch", fn);
    const { events, finished } = collect((e) => e.type === "error");
    await finished;
    expect(events).toEqual([{ type: "error", message: "shipment data is not valid for quoting" }]);
  });

  it("si termina sin evento final, avisa con un error", async () => {
    const { fn } = apiStub([{ status: "failed", done: true, cursor: 0, events: [] }]);
    vi.stubGlobal("fetch", fn);
    const { events, finished } = collect((e) => e.type === "error");
    await finished;
    expect(events).toEqual([{ type: "error", message: "SEARCH_FAILED" }]);
  });

  it("abort() cancela la búsqueda en el API", async () => {
    const { fn, calls } = apiStub([{ status: "running", done: false, cursor: 0, poll_after_ms: 5000, events: [] }]);
    vi.stubGlobal("fetch", fn);
    const { handle } = collect(() => false);
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes("_events"))).toBe(true));
    handle.abort();
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes("_cancel"))).toBe(true));
    const cancel = calls.find((c) => c.url.includes("_cancel"));
    expect(JSON.parse(cancel?.body ?? "{}")).toEqual({ search_id: 77 });
  });

  it("los límites del sondeo son razonables", () => {
    expect(ASYNC_SEARCH.maxDurationMs).toBeGreaterThanOrEqual(150_000);
    expect(ASYNC_SEARCH.maxFailures).toBeGreaterThan(1);
  });
});
