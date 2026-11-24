'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, type ComponentProps } from 'react';
import { PERIOD_PARAM, parsePeriod, withPeriod } from '@/lib/period';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

function Inner({ href, ...rest }: Props) {
  const period = parsePeriod(useSearchParams().get(PERIOD_PARAM));
  return <Link href={withPeriod(href, period)} {...rest} />;
}

/**
 * Enlace del shell que conserva `?periodo` (el layout no recibe searchParams).
 * Mientras se resuelven los parámetros se pinta el enlace sin periodo.
 */
export function PeriodLink(props: Props) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <Inner {...props} />
    </Suspense>
  );
}
