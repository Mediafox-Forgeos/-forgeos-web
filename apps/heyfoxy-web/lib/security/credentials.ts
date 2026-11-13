import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cifrado de credenciales de integraciones (AES-256-GCM).
 * La KEK vive solo en variables de entorno del servidor (HF_CREDENTIALS_KEK,
 * 32 bytes en base64). Nunca se envía al navegador ni se guarda en la base.
 */
export interface EncryptedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

function loadKek(raw: string | undefined): Buffer {
  if (!raw) throw new Error('HF_CREDENTIALS_KEK no configurada');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32)
    throw new Error('HF_CREDENTIALS_KEK debe tener 32 bytes');
  return key;
}

export function encryptSecret(
  plaintext: string,
  aad: string,
  kekB64 = process.env.HF_CREDENTIALS_KEK,
  keyVersion = 1,
): EncryptedSecret {
  const key = loadKek(kekB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion };
}

export function decryptSecret(
  secret: EncryptedSecret,
  aad: string,
  kekB64 = process.env.HF_CREDENTIALS_KEK,
): string {
  const key = loadKek(kekB64);
  const decipher = createDecipheriv('aes-256-gcm', key, secret.iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(secret.authTag);
  return Buffer.concat([
    decipher.update(secret.ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/** AAD recomendado: liga el secreto a su organización y fuente (anti-swap). */
export function credentialAad(
  organizationId: string,
  dataSourceId: string,
): string {
  return `heyfoxy:${organizationId}:${dataSourceId}`;
}

/** Enmascara un secreto para logs/UI: nunca más de 4 caracteres visibles. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length <= 8 ? '••••' : `••••${value.slice(-4)}`;
}
