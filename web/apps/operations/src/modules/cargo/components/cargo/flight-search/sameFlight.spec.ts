import { describe, expect, it } from "vitest";
import {
  flightIdentity,
  mergeSameFlight,
  normalizeRate,
  type FlightRate,
} from "@cargo/services/flight_search.service";

/** El mismo vuelo de KLM directo y de WebCargo va en una sola fila. */
const rate = (
  over: Record<string, unknown>,
): ReturnType<typeof normalizeRate> =>
  normalizeRate({
    airline_code: "KL",
    currency: "EUR",
    segments: [
      {
        carrier: "KL",
        flight_number: "KL0643",
        origin: "AMS",
        destination: "JFK",
        departure: "2026-11-10T10:30:00+01:00",
      },
    ],
    ...over,
  } as unknown as FlightRate);

describe("mismo vuelo de varios proveedores", () => {
  it("normaliza el numero de vuelo y el dia de salida", () => {
    const a = rate({ short_id: "a", source: "klm_quote" });
    const b = rate({
      short_id: "b",
      source: "realtime",
      segments: [
        {
          carrier: "KL",
          flight_number: "643",
          origin: "AMS",
          destination: "JFK",
          departure: "2026-11-10T10:30:00Z",
        },
      ],
    });
    expect(flightIdentity(a)).toBe("KL643|2026-11-10");
    expect(flightIdentity(b)).toBe(flightIdentity(a));
  });

  it("una fila con la mejor oferta y la otra como alternativa", () => {
    const klm = rate({
      short_id: "k",
      source: "klm_quote",
      client_price: { total: 1200 },
    });
    const wc = rate({
      short_id: "w",
      source: "realtime",
      client_price: { total: 1100 },
    });
    const other = rate({
      short_id: "o",
      source: "realtime",
      client_price: { total: 900 },
      segments: [
        {
          carrier: "AF",
          flight_number: "AF006",
          departure: "2026-11-10T12:00:00Z",
        },
      ],
    });
    const { rows, alternatives } = mergeSameFlight([klm, other, wc]);
    expect(rows.map((r) => r.short_id)).toEqual(["w", "o"]);
    expect(alternatives[wc._rowKey].map((r) => r.short_id)).toEqual(["k"]);
  });

  it("la asignable gana a la mas barata no asignable", () => {
    const klm = rate({
      short_id: "k",
      source: "klm_quote",
      client_price: { total: 1200 },
    });
    const wc = rate({
      short_id: "w",
      source: "realtime",
      client_price: { total: 1000 },
      selectable: false,
    });
    const { rows } = mergeSameFlight([wc, klm]);
    expect(rows.map((r) => r.short_id)).toEqual(["k"]);
  });

  it("no fusiona el mismo proveedor ni itinerarios incompletos", () => {
    const a = rate({
      short_id: "a",
      source: "realtime",
      client_price: { total: 1 },
    });
    const b = rate({
      short_id: "b",
      source: "realtime",
      client_price: { total: 2 },
    });
    const c = rate({
      short_id: "c",
      source: "klm_quote",
      segments: [{ carrier: "KL", flight_number: null }],
    });
    const { rows, alternatives } = mergeSameFlight([a, b, c]);
    expect(rows).toHaveLength(3);
    expect(Object.keys(alternatives)).toHaveLength(0);
  });
});
