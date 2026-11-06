import { describe, expect, it, vi } from 'vitest';
import { appPageUrl, mailCallbackUrl, MAIL_LANDING_PATHS } from '@shared/platform/appPageUrl';

describe('appPageUrl', () => {
  it('une origen y camino', () => {
    expect(appPageUrl('/offer', 'https://sandbox.erp.findair.it', '/')).toBe('https://sandbox.erp.findair.it/offer');
  });

  it('respeta la base de despliegue y no duplica barras', () => {
    expect(appPageUrl('offer', 'https://x.example/', '/erp/')).toBe('https://x.example/erp/offer');
  });

  it('por defecto usa el origen de la pestaña', () => {
    vi.stubGlobal('window', { location: { origin: 'https://tab.example' } });
    expect(appPageUrl('/offer', undefined, '/')).toBe('https://tab.example/offer');
    vi.unstubAllGlobals();
  });

  it('mailCallbackUrl resuelve las pantallas declaradas', () => {
    expect(mailCallbackUrl('cargoCarrierOffer', 'https://a.example', '/')).toBe('https://a.example' + MAIL_LANDING_PATHS.cargoCarrierOffer);
  });
});
