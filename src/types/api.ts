// ============================================================
// Authentication
// ============================================================

export interface LoginRequest {
  email: string;
}

export interface RegisterRequest {
  email: string;
  org_name: string;
}

export interface MagicLinkStatusResponse {
  status: 'PENDING' | 'CONSUMED' | 'EXPIRED';
  access_token?: string;
  refresh_token?: string;
  org_id?: string;
  org_name?: string;
  access_token_expires_at?: number;
  refresh_token_expires_at?: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  access_token_expires_at: number;
}

// ============================================================
// Organization
// ============================================================

export interface Organization {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Developer
// ============================================================

export interface Developer {
  id: string;
  organization_id?: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// API Key
// ============================================================

export interface ApiKey {
  id: string;
  developer_id: string;
  name: string;
  api_key?: string; // Full key value, only returned on create/rotate
  key_prefix: string;
  status: string;
  last_used_at?: string | null;
  created_at: string;
}

// ============================================================
// Payment Method
// ============================================================

export interface PaymentMethod {
  id: string;
  type: string;
  brand?: string;
  first_six?: string;
  last_four?: string;
  status: string;
  magic_link_token?: string;
  expires_at?: string;
  created_at: string;
}

// ============================================================
// Payment Tokens
// ============================================================

export interface VcnToken {
  id: string;
  type: 'vcn';
  card_number: string;
  expiry: string;
  cvc: string;
  last_four: string;
  amount_limit: number;
  currency: string;
  status: string;
}

export interface NetworkToken {
  id: string;
  type: 'network_token';
  brand: string;
  token_first_six: string;
  token_last_four: string;
  eci: string;
  cryptogram: string;
  expiry: string;
  value: string;
}

export interface X402Token {
  id: string;
  type: 'x402';
  status: string;
  signature_value: string;
}

export type PaymentToken = VcnToken | NetworkToken | X402Token;

// ============================================================
// Disable / Revoke results
// ============================================================

export interface DisableResult {
  status: string;
  revoked_tokens_count?: number;
}

export interface RevokeResult {
  id: string;
  status: string;
  revoked_at: string;
}
