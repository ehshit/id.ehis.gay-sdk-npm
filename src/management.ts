import type { ApiKeyPatch, ManagementConfig } from "./types.js";
import { IdEhisGayError } from "./errors.js";

const DEFAULT_API = "https://id.ehis.gay";

function enc(value: string): string {
  return encodeURIComponent(value);
}

function fail(status: number | null, message: string): never {
  console.error(`[id.ehis.gay] request failed${status ? ` (${status})` : ""}: ${message}`);
  throw new IdEhisGayError("REQUEST_FAILED", message, { log: false });
}

function requester(key: string, baseUrl: string) {
  return async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${key}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      fail(null, (e as { message?: string })?.message || "network error");
    }
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      const obj = parsed as { statusMessage?: string; message?: string } | null;
      fail(res.status, obj?.statusMessage || obj?.message || `request failed (${res.status})`);
    }
    return parsed as T;
  };
}

export function apps(cfg: ManagementConfig) {
  const baseUrl = (cfg.baseUrl ?? DEFAULT_API).replace(/\/+$/, "");
  const request = requester(cfg.key, baseUrl);
  return {
    list: () => request("GET", "/api/apps"),
    create: (input: { name: string; redirectUris: string[]; logoUri?: string }) =>
      request("POST", "/api/apps", input),
    update: (clientId: string, update: Record<string, unknown>) =>
      request("POST", `/api/apps/${enc(clientId)}/update`, { update }),
    remove: (clientId: string) => request("DELETE", `/api/apps/${enc(clientId)}`),
    rotateSecret: (clientId: string) => request("POST", `/api/apps/${enc(clientId)}/rotate-secret`),
    setVisibility: (clientId: string, isPublic: boolean) =>
      request("POST", `/api/apps/${enc(clientId)}/visibility`, { isPublic }),
    setAccess: (clientId: string, policy: Record<string, unknown>) =>
      request("POST", `/api/apps/${enc(clientId)}/access`, policy),
    getProviders: (clientId: string) => request("GET", `/api/apps/${enc(clientId)}/providers`),
    setProviders: (clientId: string, providers: string[]) =>
      request("POST", `/api/apps/${enc(clientId)}/providers`, { providers }),
    dispute: (clientId: string, reason: string) =>
      request("POST", `/api/apps/${enc(clientId)}/dispute`, { reason }),
    logs: (page = 1) => request("GET", `/api/apps/logs?page=${page}`),
  };
}

export function account(cfg: ManagementConfig) {
  const baseUrl = (cfg.baseUrl ?? DEFAULT_API).replace(/\/+$/, "");
  const request = requester(cfg.key, baseUrl);
  return {
    apiKeys: {
      list: () => request("GET", "/api/account/api-keys"),
      create: (input: {
        name?: string;
        clientId?: string | null;
        canReadAccount?: boolean;
        canManage?: boolean;
        expiresInDays?: number;
      }) => request("POST", "/api/account/api-keys", input),
      update: (id: string, patch: ApiKeyPatch) =>
        request("PATCH", `/api/account/api-keys/${enc(id)}`, patch),
      remove: (id: string) => request("DELETE", `/api/account/api-keys/${enc(id)}`),
    },
    consentedApps: {
      list: () => request("GET", "/api/account/consented-apps"),
      revoke: (id: string) => request("POST", `/api/account/consented-apps/${enc(id)}/revoke`),
    },
  };
}