import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ruta relativa, como en los demas specs que prueban codigo de packages/.
const MOD = "../../../packages/platform/platform/themeMode";

type Mod = typeof import("../../../packages/platform/platform/themeMode");

function fakeWindow(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const listeners: Array<(e: { key: string; newValue: string | null }) => void> = [];
  return {
    store,
    listeners,
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    addEventListener: (_type: string, fn: (e: { key: string; newValue: string | null }) => void) => {
      listeners.push(fn);
    },
  };
}

/** Tema de Vuetify minimo: nombre activo y temas registrados. */
function fakeTheme(name: string) {
  const names = ["tmweShipment", "tmweShipmentDark", "shipmentV2Light", "shipmentV2Dark"];
  return {
    global: { name: { value: name } },
    themes: { value: Object.fromEntries(names.map((n) => [n, {}])) },
  } as unknown as Parameters<Mod["applyThemeMode"]>[0];
}

async function load(win: ReturnType<typeof fakeWindow>): Promise<Mod> {
  vi.resetModules();
  vi.stubGlobal("window", win);
  return (await import(MOD)) as Mod;
}

describe("themeMode: una sola preferencia de tema", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("sin preferencia guardada arranca en claro (no sigue al sistema operativo)", async () => {
    const m = await load(fakeWindow());
    expect(m.themeMode.value).toBe("light");
    expect(m.themeNameFor("base")).toBe("tmweShipment");
  });

  it("ignora las claves antiguas de cada ficha: solo cuenta la eleccion del usuario", async () => {
    const m = await load(fakeWindow({ "shipment_express.theme": "dark", "cargo_express.theme": "dark" }));
    expect(m.themeMode.value).toBe("light");
  });

  it("el boton cambia el modo y lo guarda", async () => {
    const win = fakeWindow();
    const m = await load(win);
    m.toggleThemeMode();
    expect(m.themeMode.value).toBe("dark");
    expect(win.store.get(m.THEME_MODE_STORAGE_KEY)).toBe("dark");
  });

  it("entrar y salir de una ficha conserva el modo y solo cambia la paleta", async () => {
    const m = await load(fakeWindow({ "tmwe.theme_mode": "light" }));
    const theme = fakeTheme("tmweShipment");
    m.applyThemeMode(theme, "shipmentV2");
    expect(theme.global.name.value).toBe("shipmentV2Light");
    m.applyThemeMode(theme, "base");
    expect(theme.global.name.value).toBe("tmweShipment");
  });

  it("con oscuro elegido, la ficha abre en oscuro", async () => {
    const m = await load(fakeWindow({ "tmwe.theme_mode": "dark" }));
    const theme = fakeTheme("tmweShipmentDark");
    m.applyThemeMode(theme, "shipmentV2");
    expect(theme.global.name.value).toBe("shipmentV2Dark");
  });

  it("sin familia, aplica el modo a la paleta de la pantalla actual", async () => {
    const m = await load(fakeWindow());
    const theme = fakeTheme("shipmentV2Light");
    m.setThemeMode("dark");
    m.applyThemeMode(theme);
    expect(theme.global.name.value).toBe("shipmentV2Dark");
  });

  it("sigue el cambio hecho en otra pestaña", async () => {
    const win = fakeWindow();
    const m = await load(win);
    win.listeners.forEach((fn) => fn({ key: m.THEME_MODE_STORAGE_KEY, newValue: "dark" }));
    expect(m.themeMode.value).toBe("dark");
  });
});
