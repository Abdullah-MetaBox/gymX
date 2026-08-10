import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id parameters.
 *
 * 19 MiB / 2 iterations / 1 lane is the OWASP-recommended baseline. Kept in
 * one place because the seeder must hash identically — a mismatch would let
 * every seeded account fail to sign in with a perfectly correct password.
 */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTIONS);
  } catch {
    // A malformed or legacy hash is a failed sign-in, not a 500.
    return false;
  }
}
