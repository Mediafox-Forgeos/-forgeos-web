/** Enmascara un teléfono E.164 dejando solo los últimos 4 dígitos. */
export function maskPhone(e164: string): string {
  return e164.length <= 4
    ? '••••'
    : `${e164.slice(0, 3)} ••• ••• ${e164.slice(-4)}`;
}
