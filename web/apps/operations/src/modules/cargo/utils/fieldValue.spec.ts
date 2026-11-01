import { describe, expect, it } from "vitest";
import { fieldValue } from "./fieldValue";

describe("fieldValue", () => {
  it("devuelve el texto del input cuando llega el evento nativo", () => {
    expect(fieldValue({ target: { value: "Test goods" } } as unknown as Event)).toBe("Test goods");
  });
  it("respeta un string que ya viene resuelto", () => {
    expect(fieldValue("4.5")).toBe("4.5");
  });
  it("devuelve vacío sin objetivo o sin valor (nunca un objeto serializado)", () => {
    expect(fieldValue(null)).toBe("");
    expect(fieldValue({} as unknown as Event)).toBe("");
    expect(fieldValue({ target: {} } as unknown as Event)).toBe("");
  });
});
