import { ref, watch, type Ref } from "vue";

/**
 * Preferencia booleana del módulo de presas guardada en este navegador (interruptores del tablero y del
 * calendario). `fallback` si no hay nada guardado o el navegador no tiene almacenamiento; en ese caso la
 * preferencia dura la sesión.
 */
export function storedFlag(key: string, fallback: boolean): Ref<boolean> {
  let initial = fallback;
  try {
    const v = localStorage.getItem(key);
    if (v !== null) initial = v === "1";
  } catch {
    /* sin almacenamiento */
  }
  const flag = ref(initial);
  watch(flag, (v) => {
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  });
  return flag;
}

/** Mostrar nombre, dirección y contacto de cada presa: misma preferencia en el tablero y en el calendario. */
export const SHOW_ADDRESSES_KEY = "tmwe:pickup-board-show-addresses";
