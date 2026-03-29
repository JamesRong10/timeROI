/**
 * Auth utilities (local-only).
 *
 * Notes:
 * - This is NOT a production authentication system.
 * - Password hashing uses SHA-256 via WebCrypto when available; otherwise a tiny fallback hash
 *   is used to keep the app functional in constrained environments.
 * - For real security, use a backend auth provider or a proper native crypto implementation.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length >= 3 && normalized.includes('@') && normalized.includes('.');
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generates random hex used as a password salt.
export function randomHex(byteLength = 16): string {
  const g: any = globalThis as any;
  if (g?.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    g.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }

  // Fallback (non-cryptographic): acceptable for prototype/local-only usage.
  let hex = '';
  for (let i = 0; i < byteLength; i += 1) {
    hex += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return hex;
}

async function sha256Hex(input: string): Promise<string> {
  const g: any = globalThis as any;
  if (g?.crypto?.subtle?.digest) {
    const data = new TextEncoder().encode(input);
    const digest = await g.crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(digest));
  }

  // Extremely small fallback hash (NOT secure) if WebCrypto isn't available.
  // Keeps app functional in constrained environments.
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export async function generateSaltHex(byteLength = 16): Promise<string> {
  return randomHex(byteLength);
}

// Hashes password with a salt so we never store the raw password.
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  return sha256Hex(`${saltHex}:${password}`);
}
