export type Tokens = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

export type UserInfo = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
};

export type KeyInfo = {
  client_id: string | null;
  can_read_account: boolean;
  can_manage: boolean;
};

export type LoginConfig = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  issuer?: string;
  apiBaseUrl?: string;
  scopes?: string[];
  apiKey?: string;
};

export type AuthorizeOptions = {
  state: string;
  codeVerifier: string;
  scopes?: string[];
  checkKey?: boolean;
};

export type ManagementConfig = {
  key: string;
  baseUrl?: string;
};

export type ApiKeyPatch = {
  name?: string;
  canReadAccount?: boolean;
  canManage?: boolean;
};