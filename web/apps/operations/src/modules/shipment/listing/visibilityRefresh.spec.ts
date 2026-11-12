import { describe, expect, it } from "vitest";
import {
  REVISIT_MIN_MS,
  shouldRefreshOnReturn,
} from "@shared/listing/useVisibilityRefresh";

describe("relectura al volver a la pestaña", () => {
  it("relee si estuvo fuera el tiempo mínimo y nada lo impide", () => {
    expect(
      shouldRefreshOnReturn({ hiddenForMs: REVISIT_MIN_MS, busy: false }),
    ).toBe(true);
  });
  it("no relee si estuvo fuera menos del mínimo", () => {
    expect(
      shouldRefreshOnReturn({ hiddenForMs: REVISIT_MIN_MS - 1, busy: false }),
    ).toBe(false);
  });
  it("no relee con ficha, diálogo, selección o carga en curso", () => {
    expect(
      shouldRefreshOnReturn({ hiddenForMs: 10 * REVISIT_MIN_MS, busy: true }),
    ).toBe(false);
  });
});
