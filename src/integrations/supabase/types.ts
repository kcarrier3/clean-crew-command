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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_schedules: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: number[]
          employee_id: string
          end_date: string | null
          end_time: string | null
          id: string
          job_site_id: string
          notes: string | null
          start_date: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          employee_id: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          job_site_id: string
          notes?: string | null
          start_date: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          employee_id?: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          job_site_id?: string
          notes?: string | null
          start_date?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          employee_id: string
          first_name: string
          geofence_lat: number | null
          geofence_lng: number | null
          geofence_radius_meters: number | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          job_title: string
          last_name: string
          phone: string | null
          require_geofencing: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id: string
          first_name: string
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          job_title: string
          last_name: string
          phone?: string | null
          require_geofencing?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string
          first_name?: string
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          job_title?: string
          last_name?: string
          phone?: string | null
          require_geofencing?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      job_sites: {
        Row: {
          active: boolean
          address: string | null
          budget_info: string | null
          client_name: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          estimated_duration: string | null
          id: string
          name: string
          project_manager: string | null
          safety_requirements: string | null
          special_instructions: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          budget_info?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          estimated_duration?: string | null
          id?: string
          name: string
          project_manager?: string | null
          safety_requirements?: string | null
          special_instructions?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          budget_info?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          estimated_duration?: string | null
          id?: string
          name?: string
          project_manager?: string | null
          safety_requirements?: string | null
          special_instructions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      location_updates: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          time_entry_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          time_entry_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          time_entry_id?: string
        }
        Relationships: []
      }
      manager_report_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_url: string
          report_id: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url: string
          report_id: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          report_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "manager_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          manager_id: string
          report_date: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          manager_id: string
          report_date: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          manager_id?: string
          report_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          name: Database["public"]["Enums"]["app_permission"]
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          name: Database["public"]["Enums"]["app_permission"]
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          name?: Database["public"]["Enums"]["app_permission"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          employee_id: string | null
          first_name: string
          geofence_lat: number | null
          geofence_lng: number | null
          geofence_radius_meters: number | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          job_title: string | null
          last_name: string
          phone: string | null
          require_geofencing: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          first_name: string
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          hire_date?: string | null
          hourly_rate?: number | null
          id: string
          job_title?: string | null
          last_name: string
          phone?: string | null
          require_geofencing?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          first_name?: string
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          job_title?: string | null
          last_name?: string
          phone?: string | null
          require_geofencing?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          break_minutes: number | null
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          job_site_id: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          job_site_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          job_site_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_requests: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          id: string
          manager_notes: string | null
          reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["time_off_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          manager_notes?: string | null
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["time_off_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          manager_notes?: string | null
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["time_off_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
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
      work_order_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_type: Database["public"]["Enums"]["work_order_photo_type"]
          photo_url: string
          uploaded_by: string
          work_order_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_type: Database["public"]["Enums"]["work_order_photo_type"]
          photo_url: string
          uploaded_by: string
          work_order_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_type?: Database["public"]["Enums"]["work_order_photo_type"]
          photo_url?: string
          uploaded_by?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_photos_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          job_site_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          job_site_id: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          job_site_id?: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_message_user: {
        Args: { _recipient_id: string; _sender_id: string }
        Returns: boolean
      }
      get_or_create_conversation: {
        Args: { _user1_id: string; _user2_id: string }
        Returns: string
      }
      grant_default_employee_permissions: {
        Args: { _user_id: string }
        Returns: undefined
      }
      grant_default_manager_permissions: {
        Args: { _user_id: string }
        Returns: undefined
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_permission:
        | "view_schedules"
        | "edit_schedules"
        | "view_time_tracking"
        | "edit_time_tracking"
        | "view_work_orders"
        | "create_work_orders"
        | "edit_work_orders"
        | "view_quality_control"
        | "edit_quality_control"
        | "view_worker_status"
        | "manage_employees"
        | "view_notifications"
        | "admin_settings"
      app_role: "admin" | "manager" | "employee"
      time_off_status: "pending" | "approved" | "declined"
      work_order_photo_type: "deficiency" | "completion"
      work_order_priority: "low" | "medium" | "high" | "urgent"
      work_order_status: "open" | "in_progress" | "completed" | "reviewed"
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
      app_permission: [
        "view_schedules",
        "edit_schedules",
        "view_time_tracking",
        "edit_time_tracking",
        "view_work_orders",
        "create_work_orders",
        "edit_work_orders",
        "view_quality_control",
        "edit_quality_control",
        "view_worker_status",
        "manage_employees",
        "view_notifications",
        "admin_settings",
      ],
      app_role: ["admin", "manager", "employee"],
      time_off_status: ["pending", "approved", "declined"],
      work_order_photo_type: ["deficiency", "completion"],
      work_order_priority: ["low", "medium", "high", "urgent"],
      work_order_status: ["open", "in_progress", "completed", "reviewed"],
    },
  },
} as const
