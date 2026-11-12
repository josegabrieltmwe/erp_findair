import { describe, expect, it } from "vitest";
import {
  PICKUP_QUEUES,
  addDays,
  buildPeriodCells,
  calendarRange,
  chunk,
  failedItems,
  filterByDriver,
  formatAmount,
  isIncoherent,
  isOverdueOpen,
  isValidCap,
  manifestRows,
  manifestTotals,
  mapsCoordsUrl,
  mapsSearchUrl,
  mergeBulkResults,
  pickupColorKind,
  queueFilters,
  rangeCovers,
  shiftReference,
  startOfWeek,
  stopAddress,
  stopKind,
  stopMapLinks,
  zoneChanges,
} from "./logic";
import type { CalendarDay, DriverZone, Pickup, RouteStop } from "./types";

// Fixtures sintéticas: ningún dato real.
function pickup(over: Partial<Pickup> = {}): Pickup {
  return {
    id: 1,
    id_sede: 10,
    id_contatti: 0,
    data: "2030-03-04 09:30:00",
    address_sped: "N",
    presa_fissa: "N",
    affidata: "N",
    n_colli: 1,
    peso: 2,
    note: null,
    stato: "A",
    ...over,
  };
}

function stop(over: Partial<RouteStop> = {}): RouteStop {
  return {
    order: 1,
    pickup_id: 100,
    pickup_datetime: "2030-03-04 09:30:00",
    n_colli: 2,
    peso: 5,
    note: null,
    affidata: "S",
    presa_fissa: "N",
    sede: {
      id: 1,
      label: "Sede A",
      indirizzo: "Via Prova 1",
      citta: "Cittàprova",
      prov: "XX",
      cap: "00000",
      lat: 41.5,
      lng: 12.5,
    },
    cliente: { id: 7, ragsoc: "Cliente Prova" },
    ...over,
  };
}

describe("fechas", () => {
  it("suma días cruzando mes y año", () => {
    expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
  });
  it("startOfWeek devuelve el lunes", () => {
    expect(startOfWeek("2030-03-06")).toBe("2030-03-04"); // miércoles
    expect(startOfWeek("2030-03-04")).toBe("2030-03-04"); // lunes
    expect(startOfWeek("2030-03-10")).toBe("2030-03-04"); // domingo
  });
});

describe("colas de trabajo", () => {
  const today = "2030-03-06";
  it("cada cola traduce a los filtros del servidor", () => {
    expect(queueFilters("to_assign", today)).toEqual({
      affidata: "N",
      data_da: today,
    });
    expect(queueFilters("assigned_today", today)).toEqual({
      affidata: "S",
      data: today,
    });
    expect(queueFilters("assigned_30", today)).toEqual({
      affidata: "S",
      data_da: today,
      data_a: "2030-04-05",
    });
    expect(queueFilters("unassigned_soon", today)).toEqual({
      affidata: "N",
      data_da: today,
      data_a: "2030-03-07",
    });
    expect(queueFilters("overdue", today)).toEqual({
      data_da: "2030-02-04",
      data_a: "2030-03-05",
    });
    expect(queueFilters("all", today)).toEqual({});
  });
  it("todas las vistas tienen clave i18n y id único", () => {
    const ids = PICKUP_QUEUES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      PICKUP_QUEUES.every((q) => q.labelKey.startsWith("pickup.queue.")),
    ).toBe(true);
  });
  it("vencidas: descarta las ya hechas (incluida la fecha cero del legado)", () => {
    expect(isOverdueOpen({ data_ritiro: null })).toBe(true);
    expect(isOverdueOpen({ data_ritiro: "0000-00-00" })).toBe(true);
    expect(isOverdueOpen({ data_ritiro: "2030-03-01" })).toBe(false);
  });
  it("detecta incoherencias affidata/autista", () => {
    expect(isIncoherent(pickup({ affidata: "S", id_contatti: 0 }))).toBe(true);
    expect(isIncoherent(pickup({ affidata: "N", id_contatti: 5 }))).toBe(true);
    expect(isIncoherent(pickup({ affidata: "S", id_contatti: 5 }))).toBe(false);
    expect(isIncoherent(pickup({ affidata: "N", id_contatti: 0 }))).toBe(false);
  });
});

describe("resultado masivo", () => {
  it("trocea en lotes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
  it("une los resultados y lista los fallos", () => {
    const merged = mergeBulkResults([
      {
        assigned: 1,
        failed: 1,
        results: [
          { pickup_id: 1, ok: true },
          { pickup_id: 2, ok: false, error: "Pickup not found" },
        ],
      },
      { assigned: 1, failed: 0, results: [{ pickup_id: 3, ok: true }] },
    ]);
    expect(merged.assigned).toBe(2);
    expect(merged.failed).toBe(1);
    expect(merged.results).toHaveLength(3);
    expect(failedItems(merged)).toEqual([
      { pickup_id: 2, ok: false, error: "Pickup not found" },
    ]);
  });
});

describe("calendario semana y mes", () => {
  it("rango de día, semana y mes", () => {
    expect(calendarRange("day", "2030-03-06")).toEqual({
      from: "2030-03-06",
      to: "2030-03-06",
    });
    expect(calendarRange("week", "2030-03-06")).toEqual({
      from: "2030-03-04",
      to: "2030-03-10",
    });
    // marzo de 2030 empieza viernes y acaba domingo
    expect(calendarRange("month", "2030-03-15")).toEqual({
      from: "2030-02-25",
      to: "2030-03-31",
    });
  });
  it("el mes siempre ocupa semanas completas", () => {
    for (const d of ["2030-02-10", "2030-05-01", "2030-12-31"]) {
      const cells = buildPeriodCells("month", d, []);
      expect(cells.length % 7).toBe(0);
      expect(cells[0].date).toBe(startOfWeek(cells[0].date));
    }
  });
  it("agrupa las presas por día y marca los días fuera del mes", () => {
    const days: CalendarDay[] = [
      {
        date: "2030-03-06",
        pickups: [pickup({ id: 1, affidata: "S" }), pickup({ id: 2 })],
        count: 2,
        assigned: 1,
        not_assigned: 1,
      },
    ];
    const cells = buildPeriodCells("month", "2030-03-15", days, "2030-03-06");
    const day = cells.find((c) => c.date === "2030-03-06")!;
    expect(day).toMatchObject({
      count: 2,
      assigned: 1,
      notAssigned: 1,
      isToday: true,
      inPeriod: true,
    });
    expect(day.pickups).toHaveLength(2);
    expect(cells.find((c) => c.date === "2030-02-25")!.inPeriod).toBe(false);
    expect(cells.find((c) => c.date === "2030-03-07")!.count).toBe(0);
  });
  it("la semana tiene 7 celdas, todas del periodo", () => {
    const cells = buildPeriodCells("week", "2030-03-06", []);
    expect(cells).toHaveLength(7);
    expect(cells.every((c) => c.inPeriod)).toBe(true);
  });
  it("sin contadores del API los recalcula de las presas", () => {
    const days = [
      { date: "2030-03-06", pickups: [pickup({ affidata: "S" })] },
    ] as unknown as CalendarDay[];
    const c = buildPeriodCells("week", "2030-03-06", days)[2];
    expect(c).toMatchObject({ count: 1, assigned: 1, notAssigned: 0 });
  });
  it("rangeCovers evita recargar al cambiar de vista", () => {
    const month = calendarRange("month", "2030-03-15");
    expect(rangeCovers(month, calendarRange("week", "2030-03-15"))).toBe(true);
    expect(rangeCovers(month, calendarRange("day", "2030-03-15"))).toBe(true);
    expect(rangeCovers(month, calendarRange("week", "2030-04-03"))).toBe(false);
    expect(rangeCovers(null, month)).toBe(false);
  });
  it("shiftReference avanza según la vista", () => {
    expect(shiftReference("day", "2030-03-06", 1)).toBe("2030-03-07");
    expect(shiftReference("week", "2030-03-06", -1)).toBe("2030-02-27");
    expect(shiftReference("month", "2030-03-06", 1)).toBe("2030-04-01");
  });
  it("filtra por autista (0 = sin asignar)", () => {
    const list = [
      pickup({ id: 1, id_contatti: 5 }),
      pickup({ id: 2, id_contatti: 0 }),
    ];
    expect(filterByDriver(list, null)).toHaveLength(2);
    expect(filterByDriver(list, 5).map((p) => p.id)).toEqual([1]);
    expect(filterByDriver(list, 0).map((p) => p.id)).toEqual([2]);
  });
  it("color de leyenda: triangulación > con expedición > fija > normal", () => {
    expect(
      pickupColorKind(pickup({ address_sped: "S", presa_fissa: "S" })),
    ).toBe("triangulation");
    expect(
      pickupColorKind(pickup({ presa_fissa: "S", shipment_ids: [9] })),
    ).toBe("with_shipment");
    expect(pickupColorKind(pickup({ presa_fissa: "S" }))).toBe("fixed");
    expect(pickupColorKind(pickup())).toBe("normal");
  });
});

describe("zonas CAP", () => {
  const zones: DriverZone[] = [
    { id: 1, cap: "00100", id_contatto: 5 },
    { id: 2, cap: "00101", id_contatto: 6 },
  ];
  it("valida el CAP de cinco cifras", () => {
    expect(isValidCap("00100")).toBe(true);
    expect(isValidCap(" 00100 ")).toBe(true);
    expect(isValidCap("0010")).toBe(false);
    expect(isValidCap("abcde")).toBe(false);
  });
  it("solo devuelve lo que realmente cambia", () => {
    const changes = zoneChanges(zones, {
      "00100": 5, // igual: se omite
      "00101": 0, // quitar
      "00200": 7, // nuevo
      "00300": 0, // nuevo sin autista: se omite
    });
    expect(changes).toEqual([
      { cap: "00101", id_contatto: 0 },
      { cap: "00200", id_contatto: 7 },
    ]);
  });
  it("normaliza valores no numéricos o negativos a «quitar»", () => {
    expect(zoneChanges(zones, { "00100": Number.NaN })).toEqual([
      { cap: "00100", id_contatto: 0 },
    ]);
    expect(zoneChanges(zones, { "00100": -3 })).toEqual([
      { cap: "00100", id_contatto: 0 },
    ]);
  });
});

describe("borderò", () => {
  it("sin kind (API anterior) la parada es un ritiro", () => {
    expect(stopKind(stop())).toBe("R");
    expect(stopKind(stop({ kind: "C" }))).toBe("C");
  });
  it("usa la dirección de la expedición si la parada es a domicilio", () => {
    const s = stop({
      kind: "C",
      direccion: {
        origen: "expedicion",
        nombre: "Destino Prueba",
        indirizzo: "Via Otra 9",
        cap: "11111",
        citta: "Otraciudad",
        prov: "YY",
      },
    });
    expect(stopAddress(s)).toEqual({
      name: "Destino Prueba",
      line: "Via Otra 9, 11111 Otraciudad (YY)",
      query: "Via Otra 9, 11111 Otraciudad, YY",
    });
    expect(stopAddress(stop()).line).toBe("Via Prova 1, 00000 Cittàprova (XX)");
    expect(stopAddress(stop()).name).toBe("Cliente Prova");
  });
  it("una fila por expedición; sin expediciones, una con los datos de la presa", () => {
    const rows = manifestRows([
      stop({
        order: 1,
        pickup_id: 1,
        kind: "C",
        shipments: [
          {
            id: 11,
            ldv: "0000000011",
            ref_cliente: "REF-1",
            colli: 2,
            peso: 3.5,
            contrassegno: 120.5,
          },
          { id: 12, ldv: "0000000012", colli: 1, peso: 1, contrassegno: 0 },
        ],
      }),
      stop({ order: 2, pickup_id: 2, n_colli: 4, peso: 9 }),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      kind: "C",
      ldv: "0000000011",
      ref: "REF-1",
      colli: 2,
      cod: 120.5,
      time: "09:30",
    });
    expect(rows[1].cod).toBe(0);
    expect(rows[2]).toMatchObject({ kind: "R", ldv: "", colli: 4, peso: 9 });
  });
  it("totales: los del API si vienen, si no los calcula", () => {
    const stops = [
      stop({
        kind: "C",
        shipments: [{ id: 1, ldv: "1", colli: 2, peso: 3, contrassegno: 10 }],
      }),
      stop({ pickup_id: 2 }),
    ];
    const fallback = manifestTotals(
      { total_stops: 2, total_colli: 0, total_peso: 0 },
      stops,
    );
    expect(fallback).toMatchObject({
      total_pickups: 1,
      total_deliveries: 1,
      total_contrassegno: 10,
      shipments_colli: 4, // 2 de la expedición + 2 de la presa
    });
    const api = manifestTotals(
      {
        total_stops: 2,
        total_colli: 0,
        total_peso: 0,
        total_contrassegno: 99,
        total_pickups: 5,
        total_deliveries: 6,
        shipments_colli: 7,
        shipments_peso: 8,
      },
      stops,
    );
    expect(api).toMatchObject({
      total_contrassegno: 99,
      total_pickups: 5,
      total_deliveries: 6,
      shipments_colli: 7,
      shipments_peso: 8,
    });
  });
  it("importe con dos decimales", () => {
    expect(formatAmount(12, "en")).toBe("12.00");
    expect(formatAmount(1234.5, "en")).toBe("1,234.50");
  });
});

describe("enlaces de mapa", () => {
  it("búsqueda por dirección, codificada", () => {
    expect(mapsSearchUrl("Via Prova 1, 00000 Roma")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Via%20Prova%201%2C%2000000%20Roma",
    );
    expect(mapsSearchUrl("   ")).toBe("");
  });
  it("coordenadas válidas; 0,0 y nulas no generan enlace", () => {
    expect(mapsCoordsUrl(41.5, 12.5)).toBe(
      "https://www.google.com/maps/search/?api=1&query=41.5,12.5",
    );
    expect(mapsCoordsUrl(0, 0)).toBe("");
    expect(mapsCoordsUrl(null, 12)).toBe("");
    expect(mapsCoordsUrl(Number.NaN, 12)).toBe("");
  });
  it("las coordenadas de la sede no se ofrecen si se para en la dirección de la expedición", () => {
    expect(stopMapLinks(stop()).coords).not.toBe("");
    const home = stop({
      direccion: { origen: "expedicion", indirizzo: "Via Otra 9", citta: "X" },
    });
    const links = stopMapLinks(home);
    expect(links.coords).toBe("");
    expect(links.address).toContain("Via%20Otra%209");
  });
});
