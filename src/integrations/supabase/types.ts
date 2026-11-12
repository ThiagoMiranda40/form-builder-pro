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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      forms: {
        Row: {
          closes_at: string | null
          consent_text: string | null
          created_at: string
          description: string
          edit_window_hours: number | null
          event_date: string | null
          event_time: string | null
          event_location: string | null
          id: string
          max_responses: number | null
          owner_id: string
          share_code_hash: string | null
          share_code_salt: string | null
          share_code_version: number
          share_failed_attempts: number
          share_locked_until: string | null
          share_token: string | null
          slug: string
          status: string
          success_message: string
          theme: Json
          title: string
          updated_at: string
          whatsapp_group_link: string | null
          whatsapp_group_link_updated_at: string | null
          whatsapp_group_link_updated_by: string | null
        }
        Insert: {
          closes_at?: string | null
          consent_text?: string | null
          created_at?: string
          description?: string
          edit_window_hours?: number | null
          event_date?: string | null
          event_time?: string | null
          event_location?: string | null
          id?: string
          max_responses?: number | null
          owner_id: string
          share_code_hash?: string | null
          share_code_salt?: string | null
          share_code_version?: number
          share_failed_attempts?: number
          share_locked_until?: string | null
          share_token?: string | null
          slug: string
          status?: string
          success_message?: string
          theme?: Json
          title?: string
          updated_at?: string
          whatsapp_group_link?: string | null
          whatsapp_group_link_updated_at?: string | null
          whatsapp_group_link_updated_by?: string | null
        }
        Update: {
          closes_at?: string | null
          consent_text?: string | null
          created_at?: string
          description?: string
          edit_window_hours?: number | null
          event_date?: string | null
          event_time?: string | null
          event_location?: string | null
          id?: string
          max_responses?: number | null
          owner_id?: string
          share_code_hash?: string | null
          share_code_salt?: string | null
          share_code_version?: number
          share_failed_attempts?: number
          share_locked_until?: string | null
          share_token?: string | null
          slug?: string
          status?: string
          success_message?: string
          theme?: Json
          title?: string
          updated_at?: string
          whatsapp_group_link?: string | null
          whatsapp_group_link_updated_at?: string | null
          whatsapp_group_link_updated_by?: string | null
        }
        Relationships: []
      }
      invite_batches: {
        Row: {
          created_at: string
          created_by: string
          failed: number
          form_id: string
          group_link: string
          id: string
          sent: number
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by: string
          failed?: number
          form_id: string
          group_link: string
          id?: string
          sent?: number
          status?: string
          total: number
        }
        Update: {
          created_at?: string
          created_by?: string
          failed?: number
          form_id?: string
          group_link?: string
          id?: string
          sent?: number
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_batches_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_deliveries: {
        Row: {
          batch_id: string
          channel: string
          error_code: string | null
          form_id: string
          id: string
          response_id: string
          state: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          channel: string
          error_code?: string | null
          form_id: string
          id?: string
          response_id: string
          state: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          channel?: string
          error_code?: string | null
          form_id?: string
          id?: string
          response_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_deliveries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "invite_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_deliveries_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_deliveries_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          field_type: string
          form_id: string
          help_text: string
          id: string
          label: string
          options: Json
          position: number
          required: boolean
          settings: Json
        }
        Insert: {
          created_at?: string
          field_type?: string
          form_id: string
          help_text?: string
          id?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
          settings?: Json
        }
        Update: {
          created_at?: string
          field_type?: string
          form_id?: string
          help_text?: string
          id?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          answers: Json
          consented_at: string | null
          edit_token: string
          form_id: string
          id: string
          identifier: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          consented_at?: string | null
          edit_token?: string
          form_id: string
          id?: string
          identifier?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          consented_at?: string | null
          edit_token?: string
          form_id?: string
          id?: string
          identifier?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      invite_create_batch: {
        Args: {
          p_form_id: string
          p_created_by: string
          p_response_ids: string[]
          p_min_interval_minutes?: number
          p_daily_budget?: number
          p_resend?: boolean
        }
        Returns: Json
      }
      share_register_failure: {
        Args: {
          p_form_id: string
          p_max?: number
          p_lock_minutes?: number
        }
        Returns: Json
      }
      submit_response: {
        Args: {
          p_slug: string
          p_answers: Json
          p_identifier: string | null
          p_consented?: boolean
        }
        Returns: Json
      }
      update_response: {
        Args: {
          p_token: string
          p_answers: Json
          p_identifier: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
