export interface AppConfig {
  active_org: string | null;
  api_base_url: string;
}

export interface OrgCredential {
  org_id: string;
  org_name: string;
  email: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: number; // Unix timestamp (seconds)
  refresh_token_expires_at: number;
}

export interface StoredApiKey {
  key_id: string;
  developer_id: string;
  name: string;
  key_value: string; // Full key value, written only on create
  created_at: string;
}

export interface KeyStoreData {
  [orgId: string]: StoredApiKey[];
}
