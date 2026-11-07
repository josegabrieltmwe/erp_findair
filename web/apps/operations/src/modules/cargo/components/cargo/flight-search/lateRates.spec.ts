import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openFlightSearchStream,
  type FlightSearchEvent,
} from "@cargo/services/flight_search.service";

/**
 * Tras `complete` el backend sigue entregando las aerolíneas lentas como
 * `late_rate` / `late_rate_error` hasta `late_done`. Antes la SPA las tiraba.
 */
function sse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe("respuestas tardías del stream de vuelos", () => {
  it("entrega late_rate como tarifa, late_pending en complete y late_done", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sse([
          'event: rate\ndata: {"airline":"LH","source":"realtime","rates":[{"short_id":"a"}]}\n\n',
          'event: complete\ndata: {"total_rates":1,"late_pending":true}\n\n',
          'event: late_rate\ndata: {"airline":"EK","source":"realtime","rates":[{"short_id":"b"}]}\n\n',
          'event: late_rate_error\ndata: {"airline":"QR","source":"realtime","error":"timeout"}\n\n',
          'event: late_done\ndata: {"timed_out":false}\n\n',
        ]),
      ),
    );
    const events: FlightSearchEvent[] = [];
    let done!: () => void;
    const finished = new Promise<void>((r) => (done = r));
    openFlightSearchStream({ shipment_id: 1 }, (e) => {
      events.push(e);
      if (e.type === "late_done") done();
    });
    await finished;

    expect(events.map((e) => e.type)).toEqual([
      "rate",
      "complete",
      "rate",
      "rate_error",
      "late_done",
    ]);
    const complete = events[1] as Extract<FlightSearchEvent, { type: "complete" }>;
    expect(complete.data.late_pending).toBe(true);
    const late = events[2] as Extract<FlightSearchEvent, { type: "rate" }>;
    expect(late.airline).toBe("EK");
    expect(late.rates[0].short_id).toBe("b");
  });
});
