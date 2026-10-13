export type IdEhisGayErrorCode =
  | "PRIVATE_APP"
  | "POLICY_NOT_MATCH"
  | "NON_ACCOUNTS_DISABLED"
  | "APP_DISABLED"
  | "USER_BANNED"
  | "KEY_APP_MISMATCH"
  | "REQUEST_FAILED"
  | "OAUTH_ERROR";

const KNOWN_CODES = [
  "PRIVATE_APP",
  "POLICY_NOT_MATCH",
  "NON_ACCOUNTS_DISABLED",
  "APP_DISABLED",
  "USER_BANNED",
];

export class IdEhisGayError extends Error {
  readonly code: IdEhisGayErrorCode;
  readonly description?: string;

  constructor(code: IdEhisGayErrorCode, description?: string, opts?: { log?: boolean }) {
    super(description || code);
    this.name = "IdEhisGayError";
    this.code = code;
    this.description = description;
    if (opts?.log !== false) {
      console.error(`[id.ehis.gay] ${code}${description ? ": " + description : ""}`);
    }
  }
}

export function oauthErrorFromQuery(query: {
  error?: unknown;
  error_description?: unknown;
}): IdEhisGayError | null {
  const raw = typeof query.error === "string" ? query.error : "";
  if (!raw) return null;
  const code = (KNOWN_CODES as string[]).includes(raw) ? (raw as IdEhisGayErrorCode) : "OAUTH_ERROR";
  const description = typeof query.error_description === "string" ? query.error_description : undefined;
  return new IdEhisGayError(code, description);
}