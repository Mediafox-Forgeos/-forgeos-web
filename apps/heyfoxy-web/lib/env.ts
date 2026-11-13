/** Modo de datos: sin Supabase configurado, la app corre en demostración. */
export function dataMode(): 'demo' | 'supabase' {
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? 'supabase'
    : 'demo';
}
export function whatsappMode(): 'simulate' | 'sandbox' {
  // 'live' no es seleccionable en Gate 2.
  return process.env.HF_WHATSAPP_MODE === 'sandbox' ? 'sandbox' : 'simulate';
}
