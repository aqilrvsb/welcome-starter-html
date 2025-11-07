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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          language: string | null
          name: string
          updated_at: string
          user_id: string
          voice: string | null
          voice_provider: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          language?: string | null
          name: string
          updated_at?: string
          user_id: string
          voice?: string | null
          voice_provider?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          voice?: string | null
          voice_provider?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          assistant_id: string
          created_at: string
          id: string
          phone_number_id: string | null
          status: string | null
          updated_at: string
          user_id: string
          vapi_api_key: string
        }
        Insert: {
          assistant_id: string
          created_at?: string
          id?: string
          phone_number_id?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          vapi_api_key: string
        }
        Update: {
          assistant_id?: string
          created_at?: string
          id?: string
          phone_number_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vapi_api_key?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          agent_id: string
          call_id: string
          caller_number: string
          campaign_id: string | null
          captured_data: Json | null
          contact_id: string | null
          created_at: string
          customer_name: string | null
          duration: number | null
          end_of_call_report: Json | null
          id: string
          idsale: string | null
          is_retry: boolean | null
          metadata: Json | null
          original_campaign_id: string | null
          phone_number: string | null
          retry_count: number | null
          stage_reached: string | null
          start_time: string
          status: string
          updated_at: string
          user_id: string
          vapi_call_id: string | null
        }
        Insert: {
          agent_id: string
          call_id: string
          caller_number: string
          campaign_id?: string | null
          captured_data?: Json | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          duration?: number | null
          end_of_call_report?: Json | null
          id?: string
          idsale?: string | null
          is_retry?: boolean | null
          metadata?: Json | null
          original_campaign_id?: string | null
          phone_number?: string | null
          retry_count?: number | null
          stage_reached?: string | null
          start_time: string
          status: string
          updated_at?: string
          user_id: string
          vapi_call_id?: string | null
        }
        Update: {
          agent_id?: string
          call_id?: string
          caller_number?: string
          campaign_id?: string | null
          captured_data?: Json | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          duration?: number | null
          end_of_call_report?: Json | null
          id?: string
          idsale?: string | null
          is_retry?: boolean | null
          metadata?: Json | null
          original_campaign_id?: string | null
          phone_number?: string | null
          retry_count?: number | null
          stage_reached?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_original_campaign_id_fkey"
            columns: ["original_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          campaign_name: string
          created_at: string
          current_retry_count: number | null
          failed_calls: number | null
          id: string
          max_retry_attempts: number | null
          prompt_id: string | null
          retry_enabled: boolean | null
          retry_interval_minutes: number | null
          status: string
          successful_calls: number | null
          total_numbers: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_name: string
          created_at?: string
          current_retry_count?: number | null
          failed_calls?: number | null
          id?: string
          max_retry_attempts?: number | null
          prompt_id?: string | null
          retry_enabled?: boolean | null
          retry_interval_minutes?: number | null
          status?: string
          successful_calls?: number | null
          total_numbers?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_name?: string
          created_at?: string
          current_retry_count?: number | null
          failed_calls?: number | null
          id?: string
          max_retry_attempts?: number | null
          prompt_id?: string | null
          retry_enabled?: boolean | null
          retry_interval_minutes?: number | null
          status?: string
          successful_calls?: number | null
          total_numbers?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone_number: string
          product: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone_number: string
          product?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone_number?: string
          product?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      numbers: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          phone_number: string
          phone_number_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          phone_number: string
          phone_number_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          phone_number?: string
          phone_number_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          billplz_bill_id: string | null
          billplz_url: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billplz_bill_id?: string | null
          billplz_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billplz_bill_id?: string | null
          billplz_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_config: {
        Row: {
          connection_status: string | null
          created_at: string
          erp_webhook_url: string | null
          id: string
          provider: string | null
          updated_at: string
          user_id: string
          waha_api_key: string | null
          waha_base_url: string | null
          waha_session_name: string | null
          whacenter_device_id: string | null
          freeswitch_url: string
          mikopbx_api_key: string | null
          mikopbx_ami_username: string | null
          mikopbx_ami_password: string | null
          sip_proxy_primary: string
          sip_proxy_secondary: string | null
          sip_username: string
          sip_password: string
          sip_display_name: string | null
          sip_caller_id: string | null
          sip_codec: string | null
        }
        Insert: {
          connection_status?: string | null
          created_at?: string
          erp_webhook_url?: string | null
          id?: string
          provider?: string | null
          updated_at?: string
          user_id: string
          waha_api_key?: string | null
          waha_base_url?: string | null
          waha_session_name?: string | null
          whacenter_device_id?: string | null
          freeswitch_url?: string
          mikopbx_api_key?: string | null
          mikopbx_ami_username?: string | null
          mikopbx_ami_password?: string | null
          sip_proxy_primary?: string
          sip_proxy_secondary?: string | null
          sip_username: string
          sip_password: string
          sip_display_name?: string | null
          sip_caller_id?: string | null
          sip_codec?: string | null
        }
        Update: {
          connection_status?: string | null
          created_at?: string
          erp_webhook_url?: string | null
          id?: string
          provider?: string | null
          updated_at?: string
          user_id?: string
          waha_api_key?: string | null
          waha_base_url?: string | null
          waha_session_name?: string | null
          whacenter_device_id?: string | null
          freeswitch_url?: string
          mikopbx_api_key?: string | null
          mikopbx_ami_username?: string | null
          mikopbx_ami_password?: string | null
          sip_proxy_primary?: string
          sip_proxy_secondary?: string | null
          sip_username?: string
          sip_password?: string
          sip_display_name?: string | null
          sip_caller_id?: string | null
          sip_codec?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          phone: string | null
          subscription_plan: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id: string
          phone?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          created_at: string
          first_message: string
          id: string
          prompt_name: string
          system_prompt: string
          updated_at: string
          user_id: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          first_message: string
          id?: string
          prompt_name: string
          system_prompt: string
          updated_at?: string
          user_id: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          first_message?: string
          id?: string
          prompt_name?: string
          system_prompt?: string
          updated_at?: string
          user_id?: string
          variables?: Json | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          features: Json | null
          id: string
          interval_type: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval_type: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval_type?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          status: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          password_hash: string
          phone_number: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          password_hash: string
          phone_number?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          password_hash?: string
          phone_number?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      voice_config: {
        Row: {
          auto_mode: boolean | null
          concurrent_limit: number | null
          country_code: string | null
          created_at: string
          default_name: string | null
          id: string
          manual_voice_id: string | null
          model: string | null
          optimize_streaming_latency: number | null
          provider: string | null
          similarity_boost: number | null
          speed: number | null
          stability: number | null
          style: number | null
          updated_at: string
          use_speaker_boost: boolean | null
          user_id: string
        }
        Insert: {
          auto_mode?: boolean | null
          concurrent_limit?: number | null
          country_code?: string | null
          created_at?: string
          default_name?: string | null
          id?: string
          manual_voice_id?: string | null
          model?: string | null
          optimize_streaming_latency?: number | null
          provider?: string | null
          similarity_boost?: number | null
          speed?: number | null
          stability?: number | null
          style?: number | null
          updated_at?: string
          use_speaker_boost?: boolean | null
          user_id: string
        }
        Update: {
          auto_mode?: boolean | null
          concurrent_limit?: number | null
          country_code?: string | null
          created_at?: string
          default_name?: string | null
          id?: string
          manual_voice_id?: string | null
          model?: string | null
          optimize_streaming_latency?: number | null
          provider?: string | null
          similarity_boost?: number | null
          speed?: number | null
          stability?: number | null
          style?: number | null
          updated_at?: string
          use_speaker_boost?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          image_urls: Json | null
          message_text: string
          message_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_urls?: Json | null
          message_text: string
          message_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_urls?: Json | null
          message_text?: string
          message_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_make_calls: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      create_trial_subscription: {
        Args: { p_user_id: string }
        Returns: string
      }
      increment_campaign_failed: {
        Args: { campaign_id: string }
        Returns: undefined
      }
      increment_campaign_success: {
        Args: { campaign_id: string }
        Returns: undefined
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
    Enums: {},
  },
} as const
