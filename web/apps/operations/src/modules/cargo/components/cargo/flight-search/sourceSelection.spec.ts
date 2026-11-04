import { describe, expect, it } from "vitest";
import {
  applySelectAll,
  bulkSelectableFlags,
  selectAllState,
  type SourceState,
} from "./sourceSelection";

const sources: SourceState[] = [
  { flag: "include_published", available: true, delegated: false },
  { flag: "include_realtime", available: true, delegated: true },
  { flag: "include_realtime_direct", available: true, delegated: false },
  { flag: "include_klm", available: false, delegated: false },
  { flag: "include_klm_quotes", available: true, delegated: false },
];

describe("seleccion de todas las fuentes", () => {
  it("marca solo las disponibles y no delegadas", () => {
    expect(applySelectAll(sources, true)).toEqual({
      include_published: true,
      include_realtime_direct: true,
      include_klm_quotes: true,
    });
  });

  it("desmarca todas las disponibles, tambien la delegada", () => {
    expect(applySelectAll(sources, false)).toEqual({
      include_published: false,
      include_realtime: false,
      include_realtime_direct: false,
      include_klm_quotes: false,
    });
  });

  it("no toca las fuentes sin credencial", () => {
    expect("include_klm" in applySelectAll(sources, true)).toBe(false);
    expect("include_klm" in applySelectAll(sources, false)).toBe(false);
  });

  it("no repite fuentes", () => {
    const flags = bulkSelectableFlags(sources);
    expect(new Set(flags).size).toBe(flags.length);
  });

  it("queda marcada con todas las seleccionables, aunque la delegada no lo este", () => {
    const st = selectAllState(sources, {
      include_published: true,
      include_realtime_direct: true,
      include_klm_quotes: true,
    });
    expect(st).toEqual({ checked: true, indeterminate: false });
  });

  it("queda indeterminada con una parte marcada", () => {
    expect(selectAllState(sources, { include_published: true })).toEqual({
      checked: false,
      indeterminate: true,
    });
  });

  it("queda vacia sin nada marcado", () => {
    expect(selectAllState(sources, {})).toEqual({
      checked: false,
      indeterminate: false,
    });
  });
});
