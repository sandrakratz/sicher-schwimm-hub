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
      course_participants: {
        Row: {
          course_id: string
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_participants_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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
      courses: {
        Row: {
          age_range: string | null
          created_at: string
          description: string | null
          duration: string | null
          ends_on: string | null
          id: string
          is_public: boolean
          location: string | null
          max_participants: number | null
          name: string
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
          created_at?: string
          description?: string | null
          duration?: string | null
          ends_on?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          max_participants?: number | null
          name: string
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
          created_at?: string
          description?: string | null
          duration?: string | null
          ends_on?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          max_participants?: number | null
          name?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_status: "pending" | "active" | "disabled" | "archived"
      app_role: "admin" | "board" | "trainer" | "member" | "parent"
      course_status:
        | "planned"
        | "open"
        | "waiting_list"
        | "fully_booked"
        | "completed"
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
      course_status: [
        "planned",
        "open",
        "waiting_list",
        "fully_booked",
        "completed",
      ],
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
