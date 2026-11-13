import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cliente con la sesión del usuario: RLS aplica en cada consulta. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const c of list) store.set(c.name, c.value, c.options);
          } catch {
            // Server Components no pueden escribir cookies; el middleware refresca.
          }
        },
      },
    },
  );
}
