export type UserRole =
  'Administrador' | 'Operador' | 'Soporte' | 'Analista' | 'Visualizador';

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName: string;
  status: UserStatus;
  lastActivity: string;
  isDemo: true;
};
