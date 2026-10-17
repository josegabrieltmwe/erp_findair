/**
 * Re-export del servicio completo de usuarios (Fase A2). Este archivo
 * existía como subconjunto mínimo (solo search/getById) mientras `users`
 * no estaba migrado (Fase A1) — se mantiene para no romper el import de
 * `CmUserAutocomplete.vue`, pero ahora apunta al servicio real.
 */
export { usersService, type UserLite } from '../../users/services/users.service';
