/**
 * White-label tenant configuration.
 *
 * MOVOS is the commercial product built by MediaFOX Forge. The tenant object
 * is the ONLY place customer-specific branding lives. Swapping this object
 * re-skins the entire application for a different operator. Kylum Energy is the
 * pilot customer, not the product owner — it must not leak into components.
 */
export const tenant = {
  productName: 'MOVOS',
  productDescriptor: 'Mobility Operating System',
  orgName: 'Kylum Energy',
  orgDescription: 'Operación piloto',
  accentColor: 'movos-blue', // CSS token name (see globals.css / tailwind.config)
  currency: 'COP',
  locale: 'es-CO',
} as const;

export type Tenant = typeof tenant;
