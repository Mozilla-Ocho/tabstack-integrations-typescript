import { APIError } from "@tabstack/sdk";

/**
 * A small normalised error surfaced consistently by every adapter. Wraps the
 * SDK's `APIError` (and any other thrown value) so consumers do not need to
 * depend on SDK internals to handle failures.
 */
export class TabstackToolError extends Error {
  /** HTTP status from the underlying API error, when available. */
  readonly status?: number;
  /** The original thrown value. */
  override readonly cause?: unknown;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = "TabstackToolError";
    this.status = options.status;
    this.cause = options.cause;
  }
}

/** Map any thrown value into a {@link TabstackToolError}. */
export function normalizeError(err: unknown): TabstackToolError {
  if (err instanceof TabstackToolError) {
    return err;
  }
  if (err instanceof APIError) {
    const status = typeof err.status === "number" ? err.status : undefined;
    return new TabstackToolError(err.message, { status, cause: err });
  }
  if (err instanceof Error) {
    return new TabstackToolError(err.message, { cause: err });
  }
  return new TabstackToolError("Unknown Tabstack error", { cause: err });
}
