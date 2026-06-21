export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      cancellation_requests: {
        Row: {
          booking_date: string
          child_name: string
          course_name: string
          created_at: string
          email: string
          id: string
          ip_address: unknown
          notes: string | null
          parent_first_name: string
          parent_last_name: string
          phone: string
          reference_number: string
          revocation_text: string
          status: Database["public"]["Enums"]["cancellation_status"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          booking_date: string
          child_name: string
          course_name: string
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          notes?: string | null
          parent_first_name: string
          parent_last_name: string
          phone: string
          reference_number: string
          revocation_text: string
          status?: Database["public"]["Enums"]["cancellation_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          booking_date?: string
          child_name?: string
          course_name?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          notes?: string | null
          parent_first_name?: string
          parent_last_name?: string
          phone?: string
          reference_number?: string
          revocation_text?: string
          status?: Database["public"]["Enums"]["cancellation_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      course_participants: {
        Row: {
          achievement: string | null
          badge: string | null
          course_id: string
          created_at: string
          date_of_birth: string | null
          goal_reached: boolean | null
          id: string
          is_member: boolean | null
          member_confirmed: boolean
          member_confirmed_at: string | null
          member_confirmed_by: string | null
          notes: string | null
          paid: boolean
          paid_at: string | null
          paid_by: string | null
          parent_user_id: string | null
          participant_email: string | null
          participant_name: string | null
          participant_phone: string | null
          payment_note: string | null
          price_amount: number | null
          request_id: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          achievement?: string | null
          badge?: string | null
          course_id: string
          created_at?: string
          date_of_birth?: string | null
          goal_reached?: boolean | null
          id?: string
          is_member?: boolean | null
          member_confirmed?: boolean
          member_confirmed_at?: string | null
          member_confirmed_by?: string | null
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          parent_user_id?: string | null
          participant_email?: string | null
          participant_name?: string | null
          participant_phone?: string | null
          payment_note?: string | null
          price_amount?: number | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          achievement?: string | null
          badge?: string | null
          course_id?: string
          created_at?: string
          date_of_birth?: string | null
          goal_reached?: boolean | null
          id?: string
          is_member?: boolean | null
          member_confirmed?: boolean
          member_confirmed_at?: string | null
          member_confirmed_by?: string | null
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          parent_user_id?: string | null
          participant_email?: string | null
          participant_name?: string | null
          participant_phone?: string | null
          payment_note?: string | null
          price_amount?: number | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_participants_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_participants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "course_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      course_requests: {
        Row: {
          admin_notes: string | null
          assigned_course_id: string | null
          child_dob: string | null
          child_name: string | null
          contact_permission: boolean
          created_at: string
          desired_course: string | null
          gdpr_consent: boolean
          health_info: string | null
          id: string
          message: string | null
          parent_email: string
          parent_name: string
          parent_phone: string | null
          status: Database["public"]["Enums"]["request_status"]
          swimming_level: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_course_id?: string | null
          child_dob?: string | null
          child_name?: string | null
          contact_permission?: boolean
          created_at?: string
          desired_course?: string | null
          gdpr_consent?: boolean
          health_info?: string | null
          id?: string
          message?: string | null
          parent_email: string
          parent_name: string
          parent_phone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          swimming_level?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_course_id?: string | null
          child_dob?: string | null
          child_name?: string | null
          contact_permission?: boolean
          created_at?: string
          desired_course?: string | null
          gdpr_consent?: boolean
          health_info?: string | null
          id?: string
          message?: string | null
          parent_email?: string
          parent_name?: string
          parent_phone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          swimming_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_requests_assigned_course_id_fkey"
            columns: ["assigned_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          course_id: string
          created_at: string
          id: string
          note: string | null
          session_date: string
          session_index: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          note?: string | null
          session_date: string
          session_index: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          note?: string | null
          session_date?: string
          session_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          age_range: string | null
          archived_at: string | null
          created_at: string
          description: string | null
          duration: string | null
          ends_on: string | null
          id: string
          is_public: boolean
          location: string | null
          max_participants: number | null
          name: string
          payment_due_days: number
          price_member: number | null
          price_non_member: number | null
          schedule: string | null
          slug: string
          starts_on: string | null
          status: Database["public"]["Enums"]["course_status"]
          target_group: string | null
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          ends_on?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          max_participants?: number | null
          name: string
          payment_due_days?: number
          price_member?: number | null
          price_non_member?: number | null
          schedule?: string | null
          slug: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          target_group?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          ends_on?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          max_participants?: number | null
          name?: string
          payment_due_days?: number
          price_member?: number | null
          price_non_member?: number | null
          schedule?: string | null
          slug?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          target_group?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
          version: string | null
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
          version?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
          version?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: []
      }
      memberships: {
        Row: {
          accepted_privacy: boolean
          accepted_rules: boolean
          accepted_statutes: boolean
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          approved_at: string | null
          approved_by: string | null
          consent_at: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          family_members: Json | null
          first_name: string
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          last_name: string
          membership_type: Database["public"]["Enums"]["membership_type"]
          notes: string | null
          phone: string | null
          sepa_account_holder: string | null
          sepa_bank_name: string | null
          sepa_bic: string | null
          sepa_iban: string | null
          sepa_mandate_accepted: boolean
          sepa_signature_date: string | null
          sepa_signature_place: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_privacy?: boolean
          accepted_rules?: boolean
          accepted_statutes?: boolean
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          approved_at?: string | null
          approved_by?: string | null
          consent_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          family_members?: Json | null
          first_name: string
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name: string
          membership_type: Database["public"]["Enums"]["membership_type"]
          notes?: string | null
          phone?: string | null
          sepa_account_holder?: string | null
          sepa_bank_name?: string | null
          sepa_bic?: string | null
          sepa_iban?: string | null
          sepa_mandate_accepted?: boolean
          sepa_signature_date?: string | null
          sepa_signature_place?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_privacy?: boolean
          accepted_rules?: boolean
          accepted_statutes?: boolean
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          approved_at?: string | null
          approved_by?: string | null
          consent_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          family_members?: Json | null
          first_name?: string
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name?: string
          membership_type?: Database["public"]["Enums"]["membership_type"]
          notes?: string | null
          phone?: string | null
          sepa_account_holder?: string | null
          sepa_bank_name?: string | null
          sepa_bic?: string | null
          sepa_iban?: string | null
          sepa_mandate_accepted?: boolean
          sepa_signature_date?: string | null
          sepa_signature_place?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          category: string
          created_at: string
          from_email: string
          from_name: string
          from_user_id: string | null
          id: string
          internal_notes: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          from_email: string
          from_name: string
          from_user_id?: string | null
          id?: string
          internal_notes?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          from_email?: string
          from_name?: string
          from_user_id?: string | null
          id?: string
          internal_notes?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          author_id: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          author_id?: string | null
          category?: string
          content: string
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          author_id?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_active_membership: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      account_status: "pending" | "active" | "disabled" | "archived"
      app_role: "admin" | "board" | "trainer" | "member" | "parent"
      cancellation_status: "eingegangen" | "in_bearbeitung" | "abgeschlossen"
      course_status:
        | "planned"
        | "open"
        | "waiting_list"
        | "fully_booked"
        | "completed"
      enrollment_status: "confirmed" | "waiting" | "cancelled"
      membership_status: "pending" | "active" | "suspended" | "terminated"
      membership_type: "children_youth" | "adult" | "family" | "supporting"
      request_status:
        | "new"
        | "under_review"
        | "contacted"
        | "accepted"
        | "waiting_list"
        | "rejected"
      visibility: "public" | "members" | "trainers" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["pending", "active", "disabled", "archived"],
      app_role: ["admin", "board", "trainer", "member", "parent"],
      cancellation_status: ["eingegangen", "in_bearbeitung", "abgeschlossen"],
      course_status: [
        "planned",
        "open",
        "waiting_list",
        "fully_booked",
        "completed",
      ],
      enrollment_status: ["confirmed", "waiting", "cancelled"],
      membership_status: ["pending", "active", "suspended", "terminated"],
      membership_type: ["children_youth", "adult", "family", "supporting"],
      request_status: [
        "new",
        "under_review",
        "contacted",
        "accepted",
        "waiting_list",
        "rejected",
      ],
      visibility: ["public", "members", "trainers", "admin"],
    },
  },
} as const
