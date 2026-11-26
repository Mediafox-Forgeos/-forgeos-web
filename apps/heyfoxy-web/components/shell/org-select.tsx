'use client';

import type { SelectHTMLAttributes } from 'react';

/**
 * `<select>` del selector de organización: al elegir otra organización envía su formulario
 * (server action `switchOrg`, que valida la membresía en el servidor). Sin JavaScript sigue
 * funcionando con el botón «Cambiar organización».
 */
export function OrgSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => {
        if (e.currentTarget.value !== props.defaultValue)
          e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
