import type { Platform, ProviderId, Role } from '@/lib/types';

/**
 * DATOS DE DEMOSTRACIÓN — 100 % FICTICIOS.
 * Organizaciones, marcas, personas y comentarios son inventados. No
 * representan a MedPlus, Banco de Occidente ni a ninguna entidad real.
 */
export const DEMO_ORGS = [
  {
    id: '00000000-0000-4000-a000-0000000000a1',
    name: 'Clínica Aurora (DEMO)',
    slug: 'demo-clinica-aurora',
    brand: 'Clínica Aurora',
    sector: 'salud',
  },
  {
    id: '00000000-0000-4000-a000-0000000000b1',
    name: 'Banco Horizonte (DEMO)',
    slug: 'demo-banco-horizonte',
    brand: 'Banco Horizonte',
    sector: 'banca',
  },
] as const;

export const DEMO_USERS: Array<{
  id: string;
  name: string;
  email: string;
  memberships: Array<{ org: string; role: Role }>;
}> = [
  {
    id: 'demo-user-owner',
    name: 'Laura Demo (owner)',
    email: 'owner@demo.heyfoxy.test',
    memberships: [
      { org: DEMO_ORGS[0].id, role: 'owner' },
      { org: DEMO_ORGS[1].id, role: 'owner' },
    ],
  },
  {
    id: 'demo-user-analyst',
    name: 'Andrés Demo (analyst)',
    email: 'analyst@demo.heyfoxy.test',
    memberships: [{ org: DEMO_ORGS[0].id, role: 'analyst' }],
  },
  {
    id: 'demo-user-responder',
    name: 'Camila Demo (responder)',
    email: 'responder@demo.heyfoxy.test',
    memberships: [{ org: DEMO_ORGS[0].id, role: 'responder' }],
  },
  {
    id: 'demo-user-viewer',
    name: 'Mateo Demo (viewer)',
    email: 'viewer@demo.heyfoxy.test',
    memberships: [{ org: DEMO_ORGS[0].id, role: 'viewer' }],
  },
  {
    id: 'demo-user-bank',
    name: 'Sofía Demo (admin banco)',
    email: 'bank@demo.heyfoxy.test',
    memberships: [{ org: DEMO_ORGS[1].id, role: 'admin' }],
  },
];

type Seed = { h: number; platform: Platform; text: string; author: string };

/** h = horas hacia atrás desde "ahora". */
export const DEMO_COMMENTS: Record<string, Seed[]> = {
  [DEMO_ORGS[0].id]: [
    {
      h: 1,
      platform: 'instagram',
      author: 'paciente_ficticio_01',
      text: 'Llevo 3 horas de espera en urgencias con mi mamá, pésimo servicio, nadie nos informa nada',
    },
    {
      h: 2,
      platform: 'facebook',
      author: 'usuario_demo_02',
      text: '¿Cómo puedo agendar una cita con dermatología por la app? No me deja seleccionar fecha',
    },
    {
      h: 2,
      platform: 'instagram',
      author: 'usuario_demo_03',
      text: 'Excelente atención de las enfermeras del piso 4, muy amables. Gracias!',
    },
    {
      h: 3,
      platform: 'x',
      author: 'usuario_demo_04',
      text: 'Voy a poner una tutela, me negaron el procedimiento y ya pasaron dos meses. Supersalud tiene que saber esto',
    },
    {
      h: 4,
      platform: 'facebook',
      author: 'usuario_demo_05',
      text: 'La app no sirve, no me deja entrar con mi contraseña desde ayer',
    },
    {
      h: 5,
      platform: 'instagram',
      author: 'usuario_demo_06',
      text: 'La app no sirve, imposible ver los resultados de laboratorio',
    },
    {
      h: 5,
      platform: 'instagram',
      author: 'usuario_demo_07',
      text: 'La aplicación está caída otra vez? no carga la agenda',
    },
    {
      h: 6,
      platform: 'x',
      author: 'periodista_ficticio',
      text: 'Varios usuarios reportan una posible infección tras procedimientos en una sede de Clínica Aurora. Estamos verificando la noticia',
    },
    {
      h: 7,
      platform: 'facebook',
      author: 'usuario_demo_09',
      text: 'Me cobraron dos veces la cuota moderadora, quiero que me devuelvan el dinero',
    },
    {
      h: 9,
      platform: 'instagram',
      author: 'usuario_demo_10',
      text: 'Recomiendo mucho al equipo de pediatría, genial',
    },
    {
      h: 11,
      platform: 'facebook',
      author: 'usuario_demo_11',
      text: '¿Dónde queda la nueva sede del norte?',
    },
    {
      h: 13,
      platform: 'instagram',
      author: 'usuario_demo_12',
      text: 'Gana dinero desde casa haz clic aquí bit.ly/xxxxx',
    },
    {
      h: 15,
      platform: 'x',
      author: 'usuario_demo_13',
      text: 'Demora terrible para las citas de especialista, 40 días para ortopedia',
    },
    {
      h: 20,
      platform: 'facebook',
      author: 'usuario_demo_14',
      text: 'Muy buen servicio en la sede centro, felicitaciones',
    },
    {
      h: 26,
      platform: 'instagram',
      author: 'usuario_demo_15',
      text: 'Turno 85 y van en el 20, la espera es eterna',
    },
    {
      h: 30,
      platform: 'facebook',
      author: 'usuario_demo_16',
      text: 'Gracias por la jornada de vacunación, todo muy organizado',
    },
    {
      h: 40,
      platform: 'x',
      author: 'usuario_demo_17',
      text: 'Mi papá falleció y aún no nos entregan la historia clínica, es una negligencia',
    },
    {
      h: 52,
      platform: 'instagram',
      author: 'usuario_demo_18',
      text: 'Cuándo abren las citas de odontología?',
    },
    {
      h: 70,
      platform: 'facebook',
      author: 'usuario_demo_19',
      text: 'Atención excelente en laboratorio, rápido y amables',
    },
    {
      h: 90,
      platform: 'instagram',
      author: 'usuario_demo_20',
      text: 'La espera para la cita de control fue corta, bien',
    },
  ],
  [DEMO_ORGS[1].id]: [
    {
      h: 1,
      platform: 'x',
      author: 'cliente_ficticio_01',
      text: 'Me hicieron un cobro que no reconozco en la tarjeta, posible fraude. Nadie contesta la línea',
    },
    {
      h: 2,
      platform: 'facebook',
      author: 'cliente_demo_02',
      text: '¿Cómo hago para cambiar la clave de la app?',
    },
    {
      h: 3,
      platform: 'instagram',
      author: 'cliente_demo_03',
      text: 'Quiero abrir una cuenta de ahorros, qué requisitos piden?',
    },
    {
      h: 4,
      platform: 'x',
      author: 'cliente_demo_04',
      text: 'La app del banco no sirve hoy, no puedo hacer transferencias',
    },
    {
      h: 4,
      platform: 'facebook',
      author: 'cliente_demo_05',
      text: 'La aplicación está caída, horrible justo en quincena',
    },
    {
      h: 8,
      platform: 'instagram',
      author: 'cliente_demo_06',
      text: 'Excelente asesoría en la oficina, muy amables, gracias',
    },
    {
      h: 12,
      platform: 'facebook',
      author: 'cliente_demo_07',
      text: 'Me subieron la cuota de manejo sin avisar',
    },
    {
      h: 30,
      platform: 'x',
      author: 'cliente_demo_08',
      text: 'Recomiendo el crédito de vivienda, proceso rápido',
    },
  ],
};

export const DEMO_SOURCES: Array<{
  provider: ProviderId;
  status:
    | 'connected'
    | 'not_connected'
    | 'insufficient_permissions'
    | 'pending_authorization';
  reason: string | null;
}> = [
  {
    provider: 'demo',
    status: 'connected',
    reason: 'Datos ficticios de demostración',
  },
  {
    provider: 'metricool',
    status: 'pending_authorization',
    reason:
      'Plan Advanced activo. Pendiente: token, brand (blogId) y autorización escrita del cliente.',
  },
  {
    provider: 'meta_graph',
    status: 'not_connected',
    reason: 'Requiere app Meta verificada y App Review.',
  },
  {
    provider: 'youtube_data',
    status: 'not_connected',
    reason: 'Sin canal configurado.',
  },
  {
    provider: 'linkedin_cm',
    status: 'insufficient_permissions',
    reason: 'Community Management API requiere aprobación de LinkedIn.',
  },
  {
    provider: 'x_api',
    status: 'not_connected',
    reason: 'Pago por uso: requiere aprobación de gasto.',
  },
];
