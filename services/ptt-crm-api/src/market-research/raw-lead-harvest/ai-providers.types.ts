export type ResearchAiAuthType = 'bearer_api_key' | 'header_api_key';

export type ResearchAiProviderRow = {
  id: number;
  code: string;
  display_name: string;
  base_url: string;
  auth_type: ResearchAiAuthType;
  auth_header_name: string | null;
  enabled: boolean;
  sort_order: number;
  notes: string | null;
  model_count: number;
  has_enabled_credential: boolean;
  created_at: string;
  updated_at: string;
};

export type ResearchAiModelRow = {
  id: number;
  provider_id: number;
  model_id: string;
  label: string;
  recommended_for: string | null;
  is_default: boolean;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ResearchAiCredentialPublic = {
  id: number;
  provider_id: number;
  label: string;
  token_hint: string;
  is_primary: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateResearchAiProviderBody = {
  code: string;
  display_name: string;
  base_url: string;
  auth_type?: ResearchAiAuthType;
  auth_header_name?: string | null;
  enabled?: boolean;
  sort_order?: number;
  notes?: string | null;
};

export type PatchResearchAiProviderBody = {
  display_name?: string;
  base_url?: string;
  auth_type?: ResearchAiAuthType;
  auth_header_name?: string | null;
  enabled?: boolean;
  sort_order?: number;
  notes?: string | null;
};

export type CreateResearchAiModelBody = {
  model_id: string;
  label: string;
  recommended_for?: string | null;
  is_default?: boolean;
  enabled?: boolean;
  sort_order?: number;
};

export type PatchResearchAiModelBody = {
  label?: string;
  recommended_for?: string | null;
  is_default?: boolean;
  enabled?: boolean;
  sort_order?: number;
};

export type CreateResearchAiCredentialBody = {
  label: string;
  api_token: string;
  is_primary?: boolean;
};

export type PatchResearchAiCredentialBody = {
  label?: string;
  enabled?: boolean;
  is_primary?: boolean;
  api_token?: string;
};

export type HarvestProviderOption = {
  code: string;
  display_name: string;
  configured: boolean;
  default_model: string | null;
  models: Array<{ id: string; label: string; recommended_for?: string }>;
};
