import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const calls: string[] = [];
const toastPush = vi.hoisted(() => vi.fn());
const svc = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
// vitest.config.ts no define el alias @cargo: se simulan los módulos que el store importa con él.
vi.mock("@cargo/services/cargo.service", () => ({
  cargoService: {},
  cargoAddressesService: {},
  packagesService: svc,
}));
vi.mock("@cargo/plugins/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));
vi.mock("@cargo/services/http", () => ({ http: vi.fn() }));
vi.mock("@cargo/services/anagrafica.service", () => ({
  anagraficaService: {},
}));
vi.mock("@cargo/composables/useCargoState", () => ({
  useCargoState: () => ({}),
}));
vi.mock("@cargo/validation/cargoRules", () => ({ validateDraft: vi.fn() }));
vi.mock("./toast.store", () => ({
  useToastStore: () => ({ push: toastPush }),
}));
vi.mock("@tmwe/shared-frontend/composables/useEntityCreate", () => ({
  useEntityCreate: () => ({ creating: { value: false }, create: vi.fn() }),
}));

import { useCargoStore } from "./cargo.store";

const server = [
  { id: 1, peso: "5" },
  { id: 2, peso: "3" },
];

async function setup() {
  const store = useCargoStore();
  store.cargo = { id: 10 } as never;
  store.packages = server as never;
  return store;
}

beforeEach(() => {
  setActivePinia(createPinia());
  calls.length = 0;
  svc.list
    .mockReset()
    .mockResolvedValue({ success: true, data: { packages: server } });
  svc.add
    .mockReset()
    .mockImplementation(async () => (calls.push("add"), { success: true }));
  svc.update
    .mockReset()
    .mockImplementation(async () => (calls.push("update"), { success: true }));
  svc.remove
    .mockReset()
    .mockImplementation(async () => (calls.push("remove"), { success: true }));
});

describe("savePackages", () => {
  it("orden: añadir, actualizar, borrar", async () => {
    const store = await setup();
    const ok = await store.savePackages([{ id: 1, peso: "5" }, { peso: "2" }]);
    expect(ok).toBe(true);
    expect(calls).toEqual(["add", "update", "remove"]);
    expect(svc.list).toHaveBeenCalled();
  });

  it("fallo en la 2.ª llamada: no se ha borrado nada y se recarga", async () => {
    const store = await setup();
    svc.update.mockImplementationOnce(async () => ({
      success: false,
      error: "boom",
    }));
    const ok = await store.savePackages([{ peso: "2" }, { id: 1, peso: "5" }]);
    expect(ok).toBe(false);
    expect(calls).toEqual(["add"]);
    expect(svc.remove).not.toHaveBeenCalled();
    expect(svc.list).toHaveBeenCalled();
  });

  it("fila nueva con peso 0: no llama al servicio ni envía allow_placeholder", async () => {
    const store = await setup();
    const ok = await store.savePackages([{ id: 1, peso: "5" }, { peso: "0" }]);
    expect(ok).toBe(false);
    expect(svc.add).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
    expect(svc.remove).not.toHaveBeenCalled();
    expect(toastPush).toHaveBeenCalledWith(
      "error",
      "cargo.toast.package_weight_required",
    );
  });
});
