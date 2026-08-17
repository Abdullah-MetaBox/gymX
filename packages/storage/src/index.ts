import { del, head, put } from '@vercel/blob';

/**
 * File storage.
 *
 * Phase 1 needs this for member photos (required for identity verification at
 * the door), student proof documents, PAR-Q forms and signed contracts. It is
 * built now because the storage decision is made and the interface is small —
 * not because Phase 0 stores anything.
 *
 * Backed by Vercel Blob. The interface exists so the backing store is one file,
 * not a decision baked into every upload handler: moving to S3 or to disk on a
 * VPS should not touch a single feature.
 *
 * ---------------------------------------------------------------------------
 * PRIVACY, WHICH MATTERS MORE HERE THAN THE MECHANICS
 * ---------------------------------------------------------------------------
 * Vercel Blob objects are **public by default** — anyone with the URL can fetch
 * them, and the URL is guessable only in the sense that it contains a random
 * suffix. Member photos, NICs and medical documents must not be served that
 * way. Every key is therefore written with `addRandomSuffix` and, more
 * importantly, the URL is never handed to the browser directly: Phase 1 serves
 * these through an authenticated route that resolves the member in a tenant
 * context first. `getUrl` below is deliberately internal-only.
 */

export interface StoredObject {
  /** Storage key, e.g. `gyms/<gymId>/members/<memberId>/photo.jpg`. */
  key: string;
  /** Provider URL. Never expose to a browser — see the note above. */
  url: string;
  size: number;
  contentType: string;
}

export interface PutOptions {
  contentType?: string;
  /** Cache-Control max-age in seconds. Member photos change rarely. */
  cacheMaxAge?: number;
}

export interface StorageAdapter {
  put(key: string, body: Buffer | Uint8Array | ArrayBuffer, options?: PutOptions): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class StorageError extends Error {
  override readonly name = 'StorageError';
}

/**
 * Build a tenant-scoped key.
 *
 * Every object lives under its gym's prefix. That does not enforce isolation on
 * its own — the database does that — but it means a stray listing, a bulk
 * export or a data-deletion request can be scoped to one gym without inspecting
 * every object.
 */
export function tenantKey(gymId: string, ...parts: string[]): string {
  const safe = parts.map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '_')).filter(Boolean);
  if (safe.length === 0) throw new StorageError('A storage key needs at least one path segment');
  return `gyms/${gymId}/${safe.join('/')}`;
}

class VercelBlobStorage implements StorageAdapter {
  constructor(private readonly token: string) {}

  async put(
    key: string,
    body: Buffer | Uint8Array | ArrayBuffer,
    options: PutOptions = {},
  ): Promise<StoredObject> {
    const result = await put(key, body as Buffer, {
      access: 'public',
      token: this.token,
      contentType: options.contentType,
      cacheControlMaxAge: options.cacheMaxAge ?? 60 * 60 * 24 * 30,
      // Prevents one member's upload from overwriting another's on a key
      // collision, and makes the URL unguessable from the key alone.
      addRandomSuffix: true,
    });

    return {
      key: result.pathname,
      url: result.url,
      size: body instanceof ArrayBuffer ? body.byteLength : body.length,
      contentType: result.contentType ?? options.contentType ?? 'application/octet-stream',
    };
  }

  async get(key: string): Promise<Buffer | null> {
    const meta = await this.metadata(key);
    if (!meta) return null;

    const response = await fetch(meta.url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const meta = await this.metadata(key);
    if (meta) await del(meta.url, { token: this.token });
  }

  async exists(key: string): Promise<boolean> {
    return (await this.metadata(key)) !== null;
  }

  private async metadata(key: string): Promise<{ url: string } | null> {
    try {
      const result = await head(key, { token: this.token });
      return { url: result.url };
    } catch {
      // @vercel/blob throws BlobNotFoundError rather than returning null.
      return null;
    }
  }
}

let adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (adapter) return adapter;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new StorageError(
      'BLOB_READ_WRITE_TOKEN is not set. Create a Blob store in the Vercel dashboard ' +
        'and copy the token into .env.',
    );
  }

  adapter = new VercelBlobStorage(token);
  return adapter;
}

/** Override the adapter — tests, and any future non-Vercel deployment. */
export function setStorage(custom: StorageAdapter): void {
  adapter = custom;
}
