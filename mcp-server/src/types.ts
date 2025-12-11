export interface Incident {
  id: string;
  status: 'pending' | 'processing' | 'fixed' | 'failed' | 'needs_review';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'database' | 'network' | 'memory' | 'disk' | 'auth' | 'application';
  summary: string;
  description: string;
  suggested_fix?: string;
  affected_file?: string;
  affected_service?: string;
  raw_log?: string;
  source?: string;
  pr_url?: string;
  pr_number?: number;
  error_message?: string;
  fix_notes?: string;
  created_at: string;
  updated_at?: string;
  fixed_at?: string;
  kestra_execution_id?: string;
  confidence?: number;
}

export interface RepositoryContext {
  repo: string;
  owner: string;
  file_path?: string;
  recent_commits?: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }>;
  related_files?: string[];
  dependencies?: string[];
  branch?: string;
}

export interface FixResult {
  incident_id: string;
  status: 'success' | 'failed' | 'needs_review';
  pr_url?: string;
  pr_number?: number;
  notes?: string;
  error?: string;
  files_changed?: string[];
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface DashboardNotification {
  type: 'incident_created' | 'incident_updated' | 'fix_completed' | 'fix_failed';
  incident: Incident;
  timestamp: string;
}
