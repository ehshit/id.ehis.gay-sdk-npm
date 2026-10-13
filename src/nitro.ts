import type { H3Event } from "h3";
import { getCookie, setCookie, deleteCookie, getQuery } from "h3";
import { login } from "./login.js";
import { IdEhisGayError, oauthErrorFromQuery } from "./errors.js";
import type { LoginConfig, Tokens, UserInfo } from "./types.js";

export type NitroLoginOptions = {
  cookieName?: string;
  cookieMaxAge?: number;
};

export function nitroLogin(cfg: LoginConfig, options: NitroLoginOptions = {}) {
  const oauth = login(cfg);
  const cookieName = options.cookieName ?? "ehid_oauth";

  return {
    oauth,

    async loginUrl(event: H3Event, opts: { scopes?: string[]; state?: string; checkKey?: boolean } = {}): Promise<string> {
      const codeVerifier = oauth.createVerifier();
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const state = opts.state ?? Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      setCookie(event, cookieName, JSON.stringify({ codeVerifier, state }), {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: options.cookieMaxAge ?? 600,
      });
      return oauth.authorizeUrl({ state, codeVerifier, scopes: opts.scopes, checkKey: opts.checkKey });
    },

    async callback(event: H3Event): Promise<{ user: UserInfo; tokens: Tokens }> {
      const query = getQuery(event) as {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
      };
      const raw = getCookie(event, cookieName);
      deleteCookie(event, cookieName);

      const oauthError = oauthErrorFromQuery(query);
      if (oauthError) throw oauthError;
      if (!raw) throw new IdEhisGayError("OAUTH_ERROR", "missing oauth state cookie");
      const saved = JSON.parse(raw) as { codeVerifier: string; state: string };
      if (!query.state || query.state !== saved.state) throw new IdEhisGayError("OAUTH_ERROR", "oauth state mismatch");
      if (!query.code) throw new IdEhisGayError("OAUTH_ERROR", "missing authorization code");

      const tokens = await oauth.exchange({ code: query.code, codeVerifier: saved.codeVerifier });
      const user = await oauth.userinfo(tokens.access_token);
      return { user, tokens };
    },
  };
}
