import * as Joi from 'joi';

/**
 * Environment variable validation schema. The application fails fast on
 * startup if any required variable is missing or malformed.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(4000),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.number().default(900),
  JWT_REFRESH_TTL: Joi.number().default(604800),
  CORS_ORIGINS: Joi.string().default('http://localhost:3002'),
  SEED_ADMIN_EMAIL: Joi.string().email().required(),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).required(),
  MOVOS_GOOGLE_MAPS_SERVER_API_KEY: Joi.string().optional().allow('').default(''),
  GOOGLE_MAPS_REGION: Joi.string().default('CO'),
  GOOGLE_MAPS_LANGUAGE: Joi.string().default('es'),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: number;
  jwtRefreshTtl: number;
  corsOrigins: string[];
  seedAdminEmail: string;
  seedAdminPassword: string;
}
