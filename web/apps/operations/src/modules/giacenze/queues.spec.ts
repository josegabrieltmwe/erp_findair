import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUEUE,
  formatDate,
  QUEUE_ORDER,
  hasDate,
  isStale,
  lifecycleStep,
  openDays,
  queueFilters,
  queueFromIndicator,
} from "./queues";
import { emptyFilters, type Giacenza } from "./types";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import itLocale from "./locales/it.json";
import nl from "./locales/nl.json";

const ZERO = "0000-00-00 00:00:00";

function g(over: Partial<Giacenza> = {}): Giacenza {
  return {
    id: 1,
    id_spedizione: 10,
    descriz: null,
    operazione: "A",
    note: null,
    data_open: "2026-11-01",
    data_close: "0000-00-00",
    giacenza_gg: 0,
    addebito_riconsegna: 0,
    cont_fornitore_data: ZERO,
    cont_cliente_data: ZERO,
    cont_destin_data: ZERO,
    risp_cliente_data: ZERO,
    stato: "A",
    ...over,
  };
}

describe("hasDate", () => {
  it("trata el centinela 0000-00-00 y los vacíos como sin fecha", () => {
    expect(hasDate(ZERO)).toBe(false);
    expect(hasDate("0000-00-00")).toBe(false);
    expect(hasDate("")).toBe(false);
    expect(hasDate(null)).toBe(false);
    expect(hasDate("2026-11-01 10:00:00")).toBe(true);
  });
});

describe("formatDate", () => {
  it("usa el formato del idioma y «—» si no hay fecha", () => {
    expect(formatDate("2026-11-05", "en-GB")).toBe("05/11/2026");
    expect(formatDate("2026-11-05", "de")).toBe("05.11.26");
    expect(formatDate("2026-11-05 09:30:00", "en-GB", true)).toContain("09:30");
    expect(formatDate(ZERO, "es")).toBe("—");
    expect(formatDate(null, "es")).toBe("—");
  });
});

describe("lifecycleStep", () => {
  it("recorre el ciclo: avisar cliente → esperar → instruir proveedor → cerrar", () => {
    expect(lifecycleStep(g())).toBe("notify_client");
    expect(lifecycleStep(g({ cont_cliente_data: "2026-11-01 09:00:00" }))).toBe(
      "waiting_client",
    );
    expect(
      lifecycleStep(
        g({
          cont_cliente_data: "2026-11-01 09:00:00",
          risp_cliente_data: "2026-11-02 09:00:00",
        }),
      ),
    ).toBe("instruct_supplier");
    expect(
      lifecycleStep(
        g({
          cont_cliente_data: "2026-11-01 09:00:00",
          risp_cliente_data: "2026-11-02 09:00:00",
          cont_fornitore_data: "2026-11-03 09:00:00",
        }),
      ),
    ).toBe("ready_to_close");
  });

  it("un aviso al proveedor anterior a la respuesta del cliente no cuenta", () => {
    expect(
      lifecycleStep(
        g({
          cont_cliente_data: "2026-11-01 09:00:00",
          risp_cliente_data: "2026-11-05 09:00:00",
          cont_fornitore_data: "2026-11-03 09:00:00",
        }),
      ),
    ).toBe("instruct_supplier");
  });

  it("una giacenza con data_close está cerrada, sea cual sea su ciclo", () => {
    expect(lifecycleStep(g({ data_close: "2026-11-04" }))).toBe("closed");
  });
});

describe("colas", () => {
  it("cada cola de trabajo usa un indicador del API (el mismo número que la home)", () => {
    expect(queueFilters("to_notify").indicator).toBe("giac_to_notify_client");
    expect(queueFilters("to_instruct_supplier").indicator).toBe(
      "giac_to_instruct_supplier",
    );
    expect(queueFilters("over_15").indicator).toBe("giac_open_over_15_days");
    expect(queueFilters("waiting_client").indicator).toBe(
      "awaiting_client_response",
    );
    expect(queueFilters("closed")).toEqual({ indicator: null, closed: "S" });
    expect(queueFilters("all")).toEqual({ indicator: null, closed: null });
  });

  it("los indicadores de la home abren su cola; los desconocidos, ninguna", () => {
    expect(queueFromIndicator("giac_to_notify_client")).toBe("to_notify");
    expect(queueFromIndicator("giac_open_over_15_days")).toBe("over_15");
    expect(queueFromIndicator("giacenze_overdue_15")).toBeNull();
    expect(queueFromIndicator("")).toBeNull();
  });

  it("la cola por defecto es la primera de la lista y todas tienen filtros válidos", () => {
    expect(DEFAULT_QUEUE).toBe(QUEUE_ORDER[0]);
    for (const q of QUEUE_ORDER) {
      const f = queueFilters(q);
      expect(Object.keys(f).sort()).toEqual(["closed", "indicator"]);
      expect({ ...emptyFilters(), ...f }.open_only).toBe(false);
    }
  });
});

describe("antigüedad", () => {
  const now = new Date("2026-11-20T12:00:00");
  it("cuenta los días desde la apertura", () => {
    expect(openDays(g({ data_open: "2026-11-10" }), now)).toBe(10);
    expect(openDays(g({ data_open: "0000-00-00" }), now)).toBe(0);
  });
  it("resalta solo las abiertas con más de 10 días", () => {
    expect(isStale(g({ data_open: "2026-11-05" }), now)).toBe(true);
    expect(isStale(g({ data_open: "2026-11-15" }), now)).toBe(false);
    expect(
      isStale(g({ data_open: "2026-10-01", data_close: "2026-10-05" }), now),
    ).toBe(false);
  });
});

describe("textos de la ficha", () => {
  const locales = { de, en, es, it: itLocale, nl } as Record<
    string,
    { giacenze: { giacenze: Record<string, unknown> } }
  >;

  function leaves(o: unknown, prefix = ""): string[] {
    if (o === null || typeof o !== "object") return [prefix];
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      leaves(v, prefix ? `${prefix}.${k}` : k),
    );
  }

  it("las 5 lenguas tienen exactamente las mismas claves", () => {
    const base = leaves(locales.es.giacenze.giacenze).sort();
    for (const [lang, d] of Object.entries(locales)) {
      expect(leaves(d.giacenze.giacenze).sort(), lang).toEqual(base);
    }
  });

  it("hay texto para cada cola, paso del ciclo y resultado", () => {
    const gg = es.giacenze.giacenze as unknown as Record<
      string,
      Record<string, unknown>
    >;
    for (const q of QUEUE_ORDER) {
      expect(gg.queue[q], `queue.${q}`).toBeTruthy();
      expect(
        (gg.queue.hint as Record<string, string>)[q],
        `hint.${q}`,
      ).toBeTruthy();
    }
    for (const s of [
      "closed",
      "notify_client",
      "waiting_client",
      "instruct_supplier",
      "ready_to_close",
    ]) {
      expect(gg.step[s], `step.${s}`).toBeTruthy();
      expect(gg.fix[s], `fix.${s}`).toBeTruthy();
    }
    for (const op of ["A", "C", "N", "R", "E"]) {
      expect(gg.operations[op], `operations.${op}`).toBeTruthy();
      expect(
        (gg.esito.hint as Record<string, string>)[op],
        `hint.${op}`,
      ).toBeTruthy();
      expect(
        (gg.esito.confirm as Record<string, string>)[op],
        `confirm.${op}`,
      ).toBeTruthy();
    }
  });
});
