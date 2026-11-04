<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

/**
 * El API rechaza a la persona con 403 `ERP_ACCESS_DENIED` (Security_Service de tmwe_api: le falta `erp:view`, el rol
 * erp_operator). Es una denegación declarada, no un fallo: UserContextProvider la convierte en «sin acceso».
 */
final class ErpAccessDenied extends \RuntimeException
{
    public const CODE = 'ERP_ACCESS_DENIED';

    public function __construct()
    {
        parent::__construct('contexto: ' . self::CODE);
    }

    /** ¿El cuerpo de error del API trae este código (`error_code` o `error.code`)? */
    public static function matches(string $body): bool
    {
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            return false;
        }
        $error = is_array($decoded['error'] ?? null) ? $decoded['error'] : [];

        return ($decoded['error_code'] ?? null) === self::CODE || ($error['code'] ?? null) === self::CODE;
    }
}
