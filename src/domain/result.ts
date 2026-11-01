export type ErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_NAME'
  | 'INVALID_PATH'
  | 'DUPLICATE'
  | 'READ_ONLY'
  | 'QUOTA'
  | 'CONFLICT'
  | 'UNSUPPORTED'
  | 'TOO_LARGE'
  | 'STORAGE';

export type DomainError = { code: ErrorCode; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(code: ErrorCode, message: string): Result<T> => ({
  ok: false,
  error: { code, message },
});
