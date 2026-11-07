import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { legShipmentId } from "./cargoLegs";
import { LEG_SIDE, useLegPanelsStore } from "@cargo/stores/leg_panels.store";

describe("tramos del cargo", () => {
  it("la recogida es id_spediz_part y la entrega id_spediz_dest", () => {
    const cargo = { id_spediz_part: "1001", id_spediz_dest: 1002 };
    expect(legShipmentId(cargo, "pickup")).toBe(1001);
    expect(legShipmentId(cargo, "delivery")).toBe(1002);
  });

  it("sin puntero (0, vacío, null o sin cargo) no hay tramo", () => {
    expect(legShipmentId({ id_spediz_part: "0", id_spediz_dest: "" }, "pickup")).toBeNull();
    expect(legShipmentId({ id_spediz_part: "0", id_spediz_dest: "" }, "delivery")).toBeNull();
    expect(legShipmentId({ id_spediz_part: null }, "pickup")).toBeNull();
    expect(legShipmentId(null, "delivery")).toBeNull();
    expect(legShipmentId({ id_spediz_part: "abc" }, "pickup")).toBeNull();
  });

  it("la recogida va a la izquierda y la entrega a la derecha", () => {
    expect(LEG_SIDE).toEqual({ pickup: "left", delivery: "right" });
  });
});

describe("paneles de tramos: solo uno abierto a la vez", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("abrir uno cierra el otro", () => {
    const p = useLegPanelsStore();
    p.open("pickup");
    expect(p.openRole).toBe("pickup");
    p.open("delivery");
    expect(p.openRole).toBe("delivery");
  });

  it("toggle sobre el abierto lo oculta; sobre el otro lo cambia", () => {
    const p = useLegPanelsStore();
    p.toggle("pickup");
    expect(p.openRole).toBe("pickup");
    p.toggle("delivery");
    expect(p.openRole).toBe("delivery");
    p.toggle("delivery");
    expect(p.openRole).toBeNull();
  });

  it("close oculta cualquiera", () => {
    const p = useLegPanelsStore();
    p.open("pickup");
    p.close();
    expect(p.openRole).toBeNull();
  });
});
