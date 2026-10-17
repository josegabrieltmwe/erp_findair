<?php

declare(strict_types=1);

namespace Findair\Bff\Auth;

final class OAuthException extends \RuntimeException
{
    public function __construct(public readonly string $oauthError, string $message = '')
    {
        parent::__construct($message !== '' ? $message : $oauthError);
    }
}
