import { http } from '../services/http';
import type { EmailPreview } from './types';

interface PreviewEnvelope {
  success?: boolean;
  data?: EmailPreview & { scenario?: string; engine?: string };
  error?: string;
  message?: string;
}

/**
 * Cliente del endpoint GENÉRICO de preview de correos (api_modelli_email_preview).
 * Sirve a cualquier escenario (partner_offer, express_rfq, cargo_offer, …): el
 * backend resuelve la plantilla por cascada partner→TMWE y sustituye los
 * placeholders con datos reales de la entidad. NO crea ofertas/OTP reales.
 */
export const emailPreviewService = {
  async preview(
    scenario: string,
    entityId: number,
    opts: { lang?: string; text?: string; mode?: string; partnerId?: number } = {},
  ): Promise<EmailPreview | null> {
    const body: Record<string, unknown> = {
      scenario,
      entity_id: entityId,
    };
    if (opts.lang != null) body.lang = opts.lang;
    if (opts.text != null) body.text = opts.text;
    if (opts.mode != null) body.mode = opts.mode;
    if (opts.partnerId != null) body.partner_id = opts.partnerId;

    const res = await http<PreviewEnvelope>('/api_modelli_email_preview', {
      method: 'POST',
      body,
    });
    return res?.success && res.data
      ? {
          subject: res.data.subject,
          body: res.data.body,
          from: res.data.from,
          lang: res.data.lang,
          tipo: res.data.tipo,
        }
      : null;
  },
};
