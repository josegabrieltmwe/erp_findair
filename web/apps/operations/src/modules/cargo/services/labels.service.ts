/**
 * Etiquetas / LDV interna TMWE para cargo — espejo del courier
 * (shipment/services/labels.service.ts). Usa el mecanismo ya establecido
 * `ajax_tmwe_label` (TMWE_Label_Generator vía RabbitMQ), que decide cargo por
 * rango de id (5M-7M) y devuelve la LDV en base64 (image o pdf).
 */
import { http } from "./http";

function basePath(): string {
  return (
    (typeof window !== "undefined" && window.__TMWE_CARGO__?.basePath) ||
    "/bff/v1"
  );
}

/** Una etiqueta LDV tal como la devuelve `ajax_tmwe_label`. */
export interface TmweLabelItem {
  package_number: number;
  format: "jpg" | "pdf" | string;
  base64: string;
  master_tracking?: string | null;
  package_tracking?: string | null;
  is_label?: boolean;
  is_image?: boolean;
}

export interface TmweLabelResponse {
  success: boolean;
  shipment?: {
    shipment_id: number;
    master_tracking_number: string;
    packages_count?: number;
    labels: TmweLabelItem[];
  };
  error?: { message: string; code?: string } | string;
}

export const cargoLabelsService = {
  /**
   * Genera la LDV interna TMWE del cargo. `output_format`: 'pdf' | 'image'.
   * La primera llamada tarda ~3-5s (render headless); las siguientes usan la
   * caché de persistencia en disco.
   */
  tmweLabel(
    cargo_id: number,
    opts: { output_format?: "image" | "pdf"; package_number?: number } = {},
  ): Promise<TmweLabelResponse> {
    // Con Bearer el contrato es POST con `options` anidado (no query plana).
    const options: Record<string, string | number> = {};
    if (opts.output_format) options.output_format = opts.output_format;
    if (opts.package_number != null) options.package_number = opts.package_number;
    return http<TmweLabelResponse>("/tmwe_label", {
      method: "POST",
      body: { shipment_id: cargo_id, options },
    });
  },

  /**
   * URL absoluta del endpoint que empaqueta TODAS las etiquetas (colli) del
   * cargo en un solo binario, generado server-side:
   *   bundle=pdf → un PDF con una etiqueta por página.
   *   bundle=zip → un ZIP con una JPG por collo.
   * Se navega a esta URL para descargar (usa la cookie de sesión del navegador),
   * evitando cargar 17 base64 en memoria o disparar 17 descargas.
   */
  bundleUrl(cargo_id: number, bundle: "pdf" | "zip"): string {
    return `${basePath()}/api_label_tmwe_bundle?shipment_id=${cargo_id}&bundle=${bundle}`;
  },
};
