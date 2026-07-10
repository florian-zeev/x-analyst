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
          delivery_timezone: string;
          delivery_time: string;
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
          delivery_timezone?: string;
          delivery_time?: string;
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
          delivery_timezone?: string;
          delivery_time?: string;
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
          digest_local_date: string | null;
          digest_delivery_time: string | null;
          watch_state_finalized_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          subject: string;
          body_md: string;
          item_count?: number;
          digest_local_date?: string | null;
          digest_delivery_time?: string | null;
          watch_state_finalized_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          subject?: string;
          body_md?: string;
          item_count?: number;
          digest_local_date?: string | null;
          digest_delivery_time?: string | null;
          watch_state_finalized_at?: string | null;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      digest_items: {
        Row: {
          id: string;
          digest_id: string;
          user_id: string;
          digest_subject: string;
          digest_created_at: string;
          section_title: string;
          title: string;
          source_label: string;
          url: string;
          via_handle: string;
          via_url: string;
          source_type: string;
          why: string;
          takeaway: string;
          tags: string[];
          final_url: string;
          content_title: string;
          content_description: string;
          content_text: string;
          rejected_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          digest_id: string;
          user_id: string;
          digest_subject: string;
          digest_created_at: string;
          section_title: string;
          title: string;
          source_label: string;
          url: string;
          via_handle?: string;
          via_url?: string;
          source_type: string;
          why: string;
          takeaway: string;
          tags?: string[];
          final_url?: string;
          content_title?: string;
          content_description?: string;
          content_text?: string;
          rejected_at?: string | null;
          created_at?: string;
        };
        Update: {
          digest_subject?: string;
          digest_created_at?: string;
          section_title?: string;
          title?: string;
          source_label?: string;
          url?: string;
          via_handle?: string;
          via_url?: string;
          source_type?: string;
          why?: string;
          takeaway?: string;
          tags?: string[];
          final_url?: string;
          content_title?: string;
          content_description?: string;
          content_text?: string;
          rejected_at?: string | null;
        };
        Relationships: [];
      };
      article_feedback: {
        Row: {
          id: string;
          user_id: string;
          digest_id: string | null;
          item_url: string;
          item_title: string;
          source_label: string;
          via_handle: string;
          tags: string[];
          direction: "more" | "less";
          reason: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          digest_id?: string | null;
          item_url: string;
          item_title: string;
          source_label: string;
          via_handle?: string;
          tags?: string[];
          direction: "more" | "less";
          reason?: string;
          note?: string;
          created_at?: string;
        };
        Update: {
          digest_id?: string | null;
          item_url?: string;
          item_title?: string;
          source_label?: string;
          via_handle?: string;
          tags?: string[];
          direction?: "more" | "less";
          reason?: string;
          note?: string;
        };
        Relationships: [];
      };
      collection_items: {
        Row: {
          id: string;
          user_id: string;
          digest_id: string | null;
          digest_item_id: string | null;
          digest_subject: string;
          digest_created_at: string | null;
          section_title: string;
          title: string;
          source_label: string;
          url: string;
          final_url: string;
          via_handle: string;
          via_url: string;
          source_type: string;
          why: string;
          takeaway: string;
          tags: string[];
          note: string;
          content_title: string;
          content_description: string;
          content_text: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          digest_id?: string | null;
          digest_item_id?: string | null;
          digest_subject?: string;
          digest_created_at?: string | null;
          section_title?: string;
          title: string;
          source_label: string;
          url: string;
          final_url?: string;
          via_handle?: string;
          via_url?: string;
          source_type?: string;
          why?: string;
          takeaway?: string;
          tags?: string[];
          note?: string;
          content_title?: string;
          content_description?: string;
          content_text?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          digest_id?: string | null;
          digest_item_id?: string | null;
          digest_subject?: string;
          digest_created_at?: string | null;
          section_title?: string;
          title?: string;
          source_label?: string;
          url?: string;
          final_url?: string;
          via_handle?: string;
          via_url?: string;
          source_type?: string;
          why?: string;
          takeaway?: string;
          tags?: string[];
          note?: string;
          content_title?: string;
          content_description?: string;
          content_text?: string;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      watches: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          objective: string;
          x_query: string;
          status: "active" | "paused" | "archived";
          source_digest_id: string | null;
          source_followup_id: string | null;
          last_checked_at: string | null;
          last_check_status: "quiet" | "material" | "error" | null;
          last_error: string | null;
          last_material_update_at: string | null;
          quiet_run_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          objective: string;
          x_query: string;
          status?: "active" | "paused" | "archived";
          source_digest_id?: string | null;
          source_followup_id?: string | null;
          last_checked_at?: string | null;
          last_check_status?: "quiet" | "material" | "error" | null;
          last_error?: string | null;
          last_material_update_at?: string | null;
          quiet_run_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          objective?: string;
          x_query?: string;
          status?: "active" | "paused" | "archived";
          last_checked_at?: string | null;
          last_check_status?: "quiet" | "material" | "error" | null;
          last_error?: string | null;
          last_material_update_at?: string | null;
          quiet_run_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      watch_checks: {
        Row: {
          id: string;
          watch_id: string;
          user_id: string;
          digest_id: string;
          digest_item_id: string | null;
          status: "quiet" | "material" | "error";
          source_url: string | null;
          headline: string;
          evidence_summary: string;
          error_message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          watch_id: string;
          user_id: string;
          digest_id: string;
          digest_item_id?: string | null;
          status: "quiet" | "material" | "error";
          source_url?: string | null;
          headline?: string;
          evidence_summary?: string;
          error_message?: string;
          created_at?: string;
        };
        Update: {
          digest_item_id?: string | null;
          status?: "quiet" | "material" | "error";
          source_url?: string | null;
          headline?: string;
          evidence_summary?: string;
          error_message?: string;
        };
        Relationships: [];
      };
      waitlist_requests: {
        Row: {
          email: string;
          status: string;
          source: string;
          request_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          email: string;
          status?: string;
          source?: string;
          request_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          status?: string;
          source?: string;
          request_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_access: {
        Row: {
          email: string;
          status: string;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          email: string;
          status?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          status?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      topic_filter_tags: {
        Args: {
          profile_user_id: string;
          selected_tags?: string[];
        };
        Returns: { tag: string }[];
      };
      activate_watch_from_followup: {
        Args: {
          p_user_id: string;
          p_source_digest_id: string;
          p_source_followup_id: string;
          p_title: string;
          p_objective: string;
          p_x_query: string;
        };
        Returns: Database["public"]["Tables"]["watches"]["Row"];
      };
      finalize_watch_checks: {
        Args: {
          p_user_id: string;
          p_digest_id: string;
          p_checks: Json;
        };
        Returns: undefined;
      };
      set_watch_status: {
        Args: {
          p_user_id: string;
          p_watch_id: string;
          p_status: string;
        };
        Returns: Database["public"]["Tables"]["watches"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
