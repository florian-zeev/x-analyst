export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      analyst_profiles: {
        Row: {
          user_id: string;
          email: string;
          interest_profile_md: string;
          x_list_id: string | null;
          discovery_queries: string[];
          priority_handles: string[];
          digest_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          interest_profile_md?: string;
          x_list_id?: string | null;
          discovery_queries?: string[];
          priority_handles?: string[];
          digest_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          interest_profile_md?: string;
          x_list_id?: string | null;
          discovery_queries?: string[];
          priority_handles?: string[];
          digest_email?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      digests: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          body_md: string;
          item_count: number;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          subject: string;
          body_md: string;
          item_count?: number;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          subject?: string;
          body_md?: string;
          item_count?: number;
          sent_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
