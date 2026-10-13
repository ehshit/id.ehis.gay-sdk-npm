import type { AuthorizeOptions, KeyInfo, LoginConfig, Tokens, UserInfo } from "./types.js";
import { IdEhisGayError, oauthErrorFromQuery } from "./errors.js";

const DEFAULT_ISSUER = "https://id.ehis.gay/api/auth";

function b64url(bytes: Uint8Array): string {
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function createChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

function apiBaseOf(cfg: LoginConfig, issuer: string): string {
  if (cfg.apiBaseUrl) return cfg.apiBaseUrl.replace(/\/+$/, "");
  const fromIssuer = issuer.match(/^(.*)\/api\/auth$/);
  return fromIssuer ? fromIssuer[1] : issuer.replace(/\/+$/, "");
}

export function login(cfg: LoginConfig) {
  const issuer = (cfg.issuer ?? DEFAULT_ISSUER).replace(/\/+$/, "");
  const apiBase = apiBaseOf(cfg, issuer);
  const scopes = cfg.scopes ?? ["openid", "profile", "email"];

  async function keyInfo(): Promise<KeyInfo | null> {
    if (!cfg.apiKey) return null;
    const res = await fetch(`${apiBase}/api/api-key-info`, {
      headers: { authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as KeyInfo | null;
  }

  async function authorizeUrl(opts: AuthorizeOptions): Promise<string> {
    if (opts.checkKey && cfg.apiKey) {
      const info = await keyInfo();
      if (info?.client_id && info.client_id !== cfg.clientId) {
        throw new IdEhisGayError(
          "KEY_APP_MISMATCH",
          `this api key can only authorize the app "${info.client_id}", not "${cfg.clientId}"`
        );
      }
    }
    const url = new URL(`${issuer}/oauth2/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", cfg.redirectUri);
    url.searchParams.set("scope", (opts.scopes ?? scopes).join(" "));
    url.searchParams.set("state", opts.state);
    url.searchParams.set("code_challenge", await createChallenge(opts.codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
    if (cfg.apiKey) url.searchParams.set("api_key", cfg.apiKey);
    return url.toString();
  }

  async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
    const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
    if (cfg.clientSecret) headers.authorization = "Basic " + btoa(`${cfg.clientId}:${cfg.clientSecret}`);
    const res = await fetch(`${issuer}/oauth2/token`, {
      method: "POST",
      headers,
      body: new URLSearchParams(body).toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & Tokens;
    if (!res.ok) {
      throw new IdEhisGayError("OAUTH_ERROR", String(data.error_description || data.error || `token request failed (${res.status})`));
    }
    return data;
  }

  return {
    issuer,
    apiBase,
    createVerifier,
    createChallenge,
    authorizeUrl,
    keyInfo,
    parseError: oauthErrorFromQuery,
    async exchange(input: { code: string; codeVerifier: string }): Promise<Tokens> {
      return tokenRequest({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: cfg.redirectUri,
        client_id: cfg.clientId,
        code_verifier: input.codeVerifier,
      });
    },
    async refresh(refreshToken: string): Promise<Tokens> {
      return tokenRequest({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: cfg.clientId,
      });
    },
    async userinfo(accessToken: string): Promise<UserInfo> {
      const res = await fetch(`${issuer}/oauth2/userinfo`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json().catch(() => ({}))) as UserInfo;
      if (!res.ok) throw new IdEhisGayError("OAUTH_ERROR", `userinfo failed (${res.status})`);
      return data;
    },
  };
}
