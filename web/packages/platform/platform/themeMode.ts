import { ref, type Ref } from 'vue';
import type { useTheme } from 'vuetify';

/**
 * Preferencia de tema del usuario (claro u oscuro): UNA sola para toda la SPA.
 *
 * Antes cada pantalla decidía por su cuenta: el botón de la barra cambiaba el tema de Vuetify sin guardarlo, y las
 * fichas de envío y de cargo leían sus propias claves (`shipment_express.*`, `cargo_express.*`) o la preferencia del
 * sistema operativo. Resultado: con el tema claro elegido, al abrir una ficha se ponía el oscuro.
 *
 * Regla: el tema solo cambia cuando el usuario lo pide (botón de tema). Cada familia de pantallas tiene su paleta
 * (`themeNameFor`), pero todas siguen este modo. Sin preferencia guardada vale el claro, que es el tema por defecto
 * de la app; no se usa `prefers-color-scheme` para no cambiar lo que el usuario ya ve.
 */
export type ThemeMode = 'light' | 'dark';

/** Familias de temas de Vuetify registradas en `apps/operations/src/plugins/vuetify.ts`. */
export type ThemeFamily = 'base' | 'shipmentV2';

export const THEME_MODE_STORAGE_KEY = 'tmwe.theme_mode';

const THEME_NAMES: Record<ThemeFamily, Record<ThemeMode, string>> = {
  base: { light: 'tmweShipment', dark: 'tmweShipmentDark' },
  shipmentV2: { light: 'shipmentV2Light', dark: 'shipmentV2Dark' },
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

/** Modo vigente, reactivo y compartido por todos los componentes y stores. */
export const themeMode: Ref<ThemeMode> = ref(readStoredThemeMode());

/** Cambia el modo y lo guarda. Solo lo llama una acción explícita del usuario. */
export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // Almacenamiento no disponible (modo privado): el modo vale para esta sesión.
  }
}

export function toggleThemeMode(): void {
  setThemeMode(themeMode.value === 'dark' ? 'light' : 'dark');
}

/** Nombre del tema de Vuetify de una familia para un modo (por defecto, el modo vigente). */
export function themeNameFor(family: ThemeFamily, mode: ThemeMode = themeMode.value): string {
  return THEME_NAMES[family][mode];
}

/** Familia a la que pertenece un nombre de tema de Vuetify; `null` si no es de las conocidas. */
export function familyOfThemeName(name: string): ThemeFamily | null {
  for (const family of Object.keys(THEME_NAMES) as ThemeFamily[]) {
    if (THEME_NAMES[family].light === name || THEME_NAMES[family].dark === name) return family;
  }
  return null;
}

type VuetifyTheme = ReturnType<typeof useTheme>;

/**
 * Pone en Vuetify el tema de `family` (o, sin familia, el de la familia del tema activo) con el modo vigente.
 * Las fichas lo llaman al montarse con su familia y al desmontarse con `base`, así el cambio de pantalla nunca
 * cambia el modo.
 */
export function applyThemeMode(theme: VuetifyTheme, family?: ThemeFamily): void {
  const target = family ?? familyOfThemeName(theme.global.name.value) ?? 'base';
  const next = themeNameFor(target);
  if (theme.global.name.value !== next && theme.themes.value[next]) {
    theme.global.name.value = next;
  }
}

// Otra pestaña cambió el tema: se sigue aquí también.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_MODE_STORAGE_KEY && isThemeMode(event.newValue)) {
      themeMode.value = event.newValue;
    }
  });
}
