import { describe, expect, it } from "vitest";
import {
  COLLECT_STATES,
  isValidReportId,
  selectedTotal,
  setPageSelection,
  stateLabelKey,
  toggleSelection,
} from "./reconciliation.logic";

describe("stateLabelKey", () => {
  it("mapea cada estado conocido", () => {
    expect(stateLabelKey("AB1")).toBe("cod_assegni.recon.state.AB1");
    expect(stateLabelKey("CLC")).toBe("cod_assegni.recon.state.CLC");
  });
  it("desconocido o vacío", () => {
    expect(stateLabelKey("zzz")).toBe("cod_assegni.recon.state.unknown");
    expect(stateLabelKey(null)).toBe("cod_assegni.recon.state.unknown");
  });
  it("los estados de cobro son un subconjunto", () => {
    expect(COLLECT_STATES).toEqual(["C", "B", "AB1", "AB2"]);
  });
});

describe("selección en lote", () => {
  it("toggle añade y quita sin mutar", () => {
    const a = [1];
    expect(toggleSelection(a, 2)).toEqual([1, 2]);
    expect(toggleSelection([1, 2], 1)).toEqual([2]);
    expect(a).toEqual([1]);
  });
  it("selección de página conserva otras páginas", () => {
    expect(setPageSelection([9], [1, 2], true)).toEqual([9, 1, 2]);
    expect(setPageSelection([9, 1, 2], [1, 2], false)).toEqual([9]);
  });
  it("total seleccionado", () => {
    const rows = [
      { id: 1, contras_imp: 10.1 },
      { id: 2, contras_imp: 20.2 },
      { id: 3, contras_imp: 5 },
    ];
    expect(selectedTotal(rows, [1, 2])).toBe(30.3);
    expect(selectedTotal(rows, [])).toBe(0);
  });
  it("valida id de remesa", () => {
    expect(isValidReportId("12")).toBe(true);
    expect(isValidReportId(0)).toBe(false);
    expect(isValidReportId("1.5")).toBe(false);
    expect(isValidReportId("")).toBe(false);
  });
});
