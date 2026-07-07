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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
