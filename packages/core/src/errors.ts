/** Typed errors shared across the domain, the server-action pipeline and the worker. */

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'tenant_context'
  | 'internal';

export class GymXError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

export class UnauthorizedError extends GymXError {
  constructor(message = 'Authentication required') {
    super('unauthorized', message, 401);
  }
}

export class ForbiddenError extends GymXError {
  constructor(message = 'You do not have permission to do that') {
    super('forbidden', message, 403);
  }
}

export class NotFoundError extends GymXError {
  constructor(message = 'Not found') {
    super('not_found', message, 404);
  }
}

export class ConflictError extends GymXError {
  constructor(message = 'Conflicting state') {
    super('conflict', message, 409);
  }
}

export class ValidationError extends GymXError {
  /** Field path -> messages, shaped for direct use by form components. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(message = 'Invalid input', fieldErrors: Record<string, string[]> = {}) {
    super('validation', message, 422);
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Thrown when tenant-scoped data is touched outside `withTenant`.
 *
 * Row-level security is the backstop that makes a cross-tenant read impossible;
 * this error is what turns "mysteriously empty result set" into a stack trace
 * pointing at the line that forgot to open a tenant context.
 */
export class TenantContextError extends GymXError {
  constructor(message = 'Tenant-scoped query attempted outside a tenant context') {
    super('tenant_context', message, 500);
  }
}

export function isGymXError(error: unknown): error is GymXError {
  return error instanceof GymXError;
}
