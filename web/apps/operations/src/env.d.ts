/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

/** Payload inyectado por el wrapper PHP (Operations_Vue_Template / legacy). */
export interface TmweOperationsBootstrap {
  basePath: string;
  language: string | null;
  csrf?: string | null;
  /** Contexto de sesión: true si el operador pertenece al partner TMWE
   *  (usado por el módulo giacenze para columnas/acciones internas). */
  isTmwe?: boolean;
  /**
   * Anagrafica de la sesión. La usa "Mi organización" para abrir la ficha del
   * PROPIO partner (sus usuarios y sedes) sin que tenga que buscarse a sí mismo
   * en el listado de clientes. 0 = no resuelta.
   */
  partnerId?: number;
  /**
   * Capacidades del operador (`tmwe`, `clients`, `my_org`…).
   *
   * Solo para no ofrecer tarjetas que el backend rechazaría con 403: cada
   * página sigue autorizando por su cuenta. Es una lista y no un flag por
   * capacidad para que añadir una sea añadir un string, no tocar cuatro sitios.
   */
  capabilities?: string[];
}

interface TmweNavGlobal {
  items?: unknown[];
  currentPath?: string;
  basePath: string;
}

/** Bootstrap del módulo cargo (integrado "tal cual"; conserva su global). */
export interface TmweCargoBootstrap {
  cargoId?: number | null;
  isNew?: boolean;
  fromExpress?: boolean;
  basePath?: string;
  language?: string | null;
  csrf?: string | null;
  /** Fecha del servidor (YYYY-MM-DD) inyectada por PHP para serverTime util. */
  serverDate?: string | null;
}

/** Bootstrap del módulo shipment (integrado "tal cual"; conserva su global). */
export interface TmweShipmentBootstrap {
  shipmentId?: number | null;
  isNew?: boolean;
  fromCargo?: number | boolean;
  /** tpc (tipo consegna) al crear express desde un cargo. */
  tpc?: string;
  basePath?: string;
  language?: string | null;
  csrf?: string | null;
  serverDate?: string | null;
}

declare global {
  interface Window {
    __TMWE_NAV__?: TmweNavGlobal;
    __TMWE_OPERATIONS__?: TmweOperationsBootstrap;
    /** Legacy per-domain bootstrap globals still emitted by old PHP templates. */
    __TMWE_TRACKING__?: TmweOperationsBootstrap;
    __TMWE_CARGO__?: TmweCargoBootstrap;
    __TMWE_SHIPMENT__?: TmweShipmentBootstrap;
  }
}

export {};
