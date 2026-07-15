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
      account_contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          job_site_id: string
          last_name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          job_site_id: string
          last_name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          job_site_id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_contacts_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_drafts: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          created_by: string
          employee_id: string | null
          end_at: string | null
          id: string
          job_site_id: string | null
          kind: Database["public"]["Enums"]["calendar_draft_kind"]
          notes: string | null
          promoted_schedule_id: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by: string
          employee_id?: string | null
          end_at?: string | null
          id?: string
          job_site_id?: string | null
          kind?: Database["public"]["Enums"]["calendar_draft_kind"]
          notes?: string | null
          promoted_schedule_id?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string | null
          end_at?: string | null
          id?: string
          job_site_id?: string | null
          kind?: Database["public"]["Enums"]["calendar_draft_kind"]
          notes?: string | null
          promoted_schedule_id?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_drafts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_drafts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_drafts_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_drafts_promoted_schedule_id_fkey"
            columns: ["promoted_schedule_id"]
            isOneToOne: false
            referencedRelation: "employee_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contact_assignments: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_contact_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "company_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contact_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contact_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          display_order: number
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
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
          account_id: string | null
          conversation_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_message_at: string
          name: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          conversation_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          conversation_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          body: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          owner_id: string | null
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          subject: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_name: string | null
          lead_id: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          last_name?: string | null
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string | null
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          account_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          lost_at: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          owner_id: string | null
          primary_contact_id: string | null
          probability: number | null
          stage_id: string
          updated_at: string
          value: number | null
          won_at: string | null
        }
        Insert: {
          account_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          stage_id: string
          updated_at?: string
          value?: number | null
          won_at?: string | null
        }
        Update: {
          account_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          stage_id?: string
          updated_at?: string
          value?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_email_logs: {
        Row: {
          body: string | null
          cc_emails: string[]
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          direction: string
          from_email: string | null
          id: string
          lead_id: string | null
          logged_by: string | null
          sent_at: string
          status: string
          subject: string | null
          to_emails: string[]
        }
        Insert: {
          body?: string | null
          cc_emails?: string[]
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction: string
          from_email?: string | null
          id?: string
          lead_id?: string | null
          logged_by?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          to_emails?: string[]
        }
        Update: {
          body?: string | null
          cc_emails?: string[]
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          from_email?: string | null
          id?: string
          lead_id?: string | null
          logged_by?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          to_emails?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "crm_email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "crm_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invoices: {
        Row: {
          amount_paid: number
          company_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          quote_id: string | null
          status: string
          subtotal: number
          tax: number
          tax_rate: number
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "crm_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_files: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          lead_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          lead_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          lead_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_submission_log: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
          submission_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
          submission_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
          submission_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          amount: number | null
          assigned_to: string | null
          close_date: string | null
          company_id: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          follow_up: boolean
          id: string
          next_step: string | null
          notes: string | null
          phone: string | null
          primary_contact_id: string | null
          probability: number | null
          source: string | null
          source_metadata: Json | null
          stage_id: string | null
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          assigned_to?: string | null
          close_date?: string | null
          company_id?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          follow_up?: boolean
          id?: string
          next_step?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          source?: string | null
          source_metadata?: Json | null
          stage_id?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          assigned_to?: string | null
          close_date?: string | null
          company_id?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          follow_up?: boolean
          id?: string
          next_step?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          source?: string | null
          source_metadata?: Json | null
          stage_id?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_meetings: {
        Row: {
          attendees: Json
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          end_at: string | null
          id: string
          lead_id: string | null
          location: string | null
          meeting_url: string | null
          notes: string | null
          owner_id: string | null
          start_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendees?: Json
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          owner_id?: string | null
          start_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendees?: Json
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          owner_id?: string | null
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          quantity: number
          quote_id: string
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          quantity?: number
          quote_id: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "crm_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quote_signatures: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          quote_id: string
          signature_data: string
          signature_type: string
          signed_at: string
          signer_email: string | null
          signer_name: string
          signer_title: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          quote_id: string
          signature_data: string
          signature_type: string
          signed_at?: string
          signer_email?: string | null
          signer_name: string
          signer_title?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          quote_id?: string
          signature_data?: string
          signature_type?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
          signer_title?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_quote_signatures_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "crm_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          notes: string | null
          quote_number: string
          status: string
          subtotal: number
          tax: number
          tax_rate: number
          terms: string | null
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          notes?: string | null
          quote_number?: string
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          notes?: string | null
          quote_number?: string
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string | null
          default_unit_price: number
          description: string | null
          id: string
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_unit_price?: number
          description?: string | null
          id?: string
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_unit_price?: number
          description?: string | null
          id?: string
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      department_employees: {
        Row: {
          created_at: string
          department_id: string
          employee_id: string
          id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          employee_id: string
          id?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      department_managers: {
        Row: {
          created_at: string
          department_id: string
          id: string
          manager_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          manager_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_managers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_managers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_managers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      directory_access_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          viewer_job_title: string
          visible_category: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          viewer_job_title: string
          visible_category: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          viewer_job_title?: string
          visible_category?: string
        }
        Relationships: []
      }
      employee_accounts: {
        Row: {
          assigned_by: string | null
          created_at: string
          employee_id: string
          id: string
          job_site_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          job_site_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          job_site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_accounts_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_accounts_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_accounts_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_document_submissions: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          document_id: string
          employee_id: string
          field_values: Json | null
          filled_pdf_path: string | null
          form_data: Json | null
          id: string
          ip_address: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signature_data: string | null
          signature_typed: string | null
          signed_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          document_id: string
          employee_id: string
          field_values?: Json | null
          filled_pdf_path?: string | null
          form_data?: Json | null
          id?: string
          ip_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_data?: string | null
          signature_typed?: string | null
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          document_id?: string
          employee_id?: string
          field_values?: Json | null
          filled_pdf_path?: string | null
          form_data?: Json | null
          id?: string
          ip_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_data?: string | null
          signature_typed?: string | null
          signed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_document_submissions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "onboarding_documents"
            referencedColumns: ["id"]
          },
        ]
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
      fixed_assets: {
        Row: {
          active: boolean
          asset_tag: string | null
          category: string | null
          condition: string
          created_at: string
          created_by: string | null
          id: string
          job_site_id: string | null
          location_kind: string
          name: string
          notes: string | null
          photo_urls: string[]
          purchase_cost: number | null
          purchase_date: string | null
          quantity: number
          retired_at: string | null
          retired_reason: string | null
          serial_number: string | null
          supply_location_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_tag?: string | null
          category?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_site_id?: string | null
          location_kind?: string
          name: string
          notes?: string | null
          photo_urls?: string[]
          purchase_cost?: number | null
          purchase_date?: string | null
          quantity?: number
          retired_at?: string | null
          retired_reason?: string | null
          serial_number?: string | null
          supply_location_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_tag?: string | null
          category?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_site_id?: string | null
          location_kind?: string
          name?: string
          notes?: string | null
          photo_urls?: string[]
          purchase_cost?: number | null
          purchase_date?: string | null
          quantity?: number
          retired_at?: string | null
          retired_reason?: string | null
          serial_number?: string | null
          supply_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_supply_location_id_fkey"
            columns: ["supply_location_id"]
            isOneToOne: false
            referencedRelation: "supply_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          category: string
          created_at: string
          id: string
          inspection_id: string
          item_name: string
          notes: string | null
          rating: string | null
          sort_order: number
          template_item_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          inspection_id: string
          item_name: string
          notes?: string | null
          rating?: string | null
          sort_order?: number
          template_item_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          inspection_id?: string
          item_name?: string
          notes?: string | null
          rating?: string | null
          sort_order?: number
          template_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          inspection_id: string
          inspection_item_id: string | null
          public_url: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          inspection_id: string
          inspection_item_id?: string | null
          public_url?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          inspection_id?: string
          inspection_item_id?: string | null
          public_url?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_template_items: {
        Row: {
          category: string
          created_at: string
          id: string
          item_name: string
          sort_order: number
          template_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          item_name: string
          sort_order?: number
          template_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          item_name?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          job_site_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          job_site_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          job_site_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_templates_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string | null
          id: string
          inspector_id: string
          job_site_id: string
          notes: string | null
          overall_rating: string | null
          overall_score: number | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          inspector_id: string
          job_site_id: string
          notes?: string | null
          overall_rating?: string | null
          overall_score?: number | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          inspector_id?: string
          job_site_id?: string
          notes?: string | null
          overall_rating?: string | null
          overall_score?: number | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sites: {
        Row: {
          access_instructions: string | null
          active: boolean
          address: string | null
          budget_info: string | null
          budgeted_hours: number | null
          client_name: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          current_month_used_hours: number | null
          current_month_year: string | null
          estimated_duration: string | null
          id: string
          is_recurring_monthly: boolean | null
          last_reset_date: string | null
          name: string
          project_manager: string | null
          qr_code_token: string
          remaining_hours: number | null
          safety_requirements: string | null
          special_instructions: string | null
          updated_at: string
          used_hours: number | null
        }
        Insert: {
          access_instructions?: string | null
          active?: boolean
          address?: string | null
          budget_info?: string | null
          budgeted_hours?: number | null
          client_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          current_month_used_hours?: number | null
          current_month_year?: string | null
          estimated_duration?: string | null
          id?: string
          is_recurring_monthly?: boolean | null
          last_reset_date?: string | null
          name: string
          project_manager?: string | null
          qr_code_token?: string
          remaining_hours?: number | null
          safety_requirements?: string | null
          special_instructions?: string | null
          updated_at?: string
          used_hours?: number | null
        }
        Update: {
          access_instructions?: string | null
          active?: boolean
          address?: string | null
          budget_info?: string | null
          budgeted_hours?: number | null
          client_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          current_month_used_hours?: number | null
          current_month_year?: string | null
          estimated_duration?: string | null
          id?: string
          is_recurring_monthly?: boolean | null
          last_reset_date?: string | null
          name?: string
          project_manager?: string | null
          qr_code_token?: string
          remaining_hours?: number | null
          safety_requirements?: string | null
          special_instructions?: string | null
          updated_at?: string
          used_hours?: number | null
        }
        Relationships: []
      }
      late_notifications: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          minutes_late: number
          notified_at: string
          time_entry_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          minutes_late: number
          notified_at?: string
          time_entry_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          minutes_late?: number
          notified_at?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_notifications_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
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
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          read_at: string | null
          sender_id: string
          sender_name: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id: string
          sender_name?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id?: string
          sender_name?: string | null
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
      missed_punch_notifications: {
        Row: {
          employee_id: string
          id: string
          minutes_late: number | null
          notes: string | null
          notification_sent_at: string
          notification_type: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          schedule_id: string | null
          scheduled_start_time: string
        }
        Insert: {
          employee_id: string
          id?: string
          minutes_late?: number | null
          notes?: string | null
          notification_sent_at?: string
          notification_type?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          schedule_id?: string | null
          scheduled_start_time: string
        }
        Update: {
          employee_id?: string
          id?: string
          minutes_late?: number | null
          notes?: string | null
          notification_sent_at?: string
          notification_type?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          schedule_id?: string | null
          scheduled_start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "missed_punch_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_punch_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_punch_notifications_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_punch_notifications_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_punch_notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "employee_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budget_history: {
        Row: {
          budgeted_hours: number
          created_at: string
          id: string
          job_site_id: string
          month_year: string
          updated_at: string
          used_hours: number
        }
        Insert: {
          budgeted_hours: number
          created_at?: string
          id?: string
          job_site_id: string
          month_year: string
          updated_at?: string
          used_hours?: number
        }
        Update: {
          budgeted_hours?: number
          created_at?: string
          id?: string
          job_site_id?: string
          month_year?: string
          updated_at?: string
          used_hours?: number
        }
        Relationships: []
      }
      onboarding_documents: {
        Row: {
          active: boolean
          auto_assign: boolean
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          document_type: string
          field_schema: Json
          id: string
          is_required: boolean
          source_pdf_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_assign?: boolean
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          document_type: string
          field_schema?: Json
          id?: string
          is_required?: boolean
          source_pdf_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_assign?: boolean
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          document_type?: string
          field_schema?: Json
          id?: string
          is_required?: boolean
          source_pdf_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      porter_assignments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          job_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          job_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          job_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "porter_assignments_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      porter_reports: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          area_label: string | null
          created_at: string
          description: string
          id: string
          issue_type: string
          job_site_id: string
          notes_from_porter: string | null
          reporter_contact: string | null
          reporter_name: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          area_label?: string | null
          created_at?: string
          description: string
          id?: string
          issue_type: string
          job_site_id: string
          notes_from_porter?: string | null
          reporter_contact?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          area_label?: string | null
          created_at?: string
          description?: string
          id?: string
          issue_type?: string
          job_site_id?: string
          notes_from_porter?: string | null
          reporter_contact?: string | null
          reporter_name?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "porter_reports_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          address_line1: string | null
          address_line2: string | null
          attendance_bonus_amount: number | null
          attendance_incentive_enrolled: boolean
          attendance_tracking_type: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
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
          pay_type: string | null
          phone: string | null
          postal_code: string | null
          profile_completed_at: string | null
          require_geofencing: boolean
          salary_amount: number | null
          state: string | null
          time_bonus_amount: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          attendance_bonus_amount?: number | null
          attendance_incentive_enrolled?: boolean
          attendance_tracking_type?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
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
          pay_type?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_completed_at?: string | null
          require_geofencing?: boolean
          salary_amount?: number | null
          state?: string | null
          time_bonus_amount?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          attendance_bonus_amount?: number | null
          attendance_incentive_enrolled?: boolean
          attendance_tracking_type?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
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
          pay_type?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_completed_at?: string | null
          require_geofencing?: boolean
          salary_amount?: number | null
          state?: string | null
          time_bonus_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system_role: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      supply_categories: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      supply_items: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
          reorder_point: number | null
          sale_price: number | null
          sku: string | null
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name: string
          reorder_point?: number | null
          sale_price?: number | null
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          reorder_point?: number | null
          sale_price?: number | null
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supply_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_locations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          job_site_id: string | null
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          job_site_id?: string | null
          kind: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          job_site_id?: string | null
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_locations_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_location_id: string | null
          id: string
          item_id: string
          job_site_id: string | null
          movement_type: string
          notes: string | null
          quantity: number
          reference: string | null
          to_location_id: string | null
          total_value: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          item_id: string
          job_site_id?: string | null
          movement_type: string
          notes?: string | null
          quantity: number
          reference?: string | null
          to_location_id?: string | null
          total_value?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          item_id?: string
          job_site_id?: string | null
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          to_location_id?: string | null
          total_value?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "supply_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "supply_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_movements_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "supply_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_requests: {
        Row: {
          created_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          item_id: string | null
          item_name_free_text: string | null
          job_site_id: string | null
          kind: string
          notes: string | null
          quantity: number
          requested_by: string
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_id?: string | null
          item_name_free_text?: string | null
          job_site_id?: string | null
          kind?: string
          notes?: string | null
          quantity?: number
          requested_by: string
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_id?: string | null
          item_name_free_text?: string | null
          job_site_id?: string | null
          kind?: string
          notes?: string | null
          quantity?: number
          requested_by?: string
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requests_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "supply_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_stock: {
        Row: {
          item_id: string
          location_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          item_id: string
          location_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          item_id?: string
          location_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "supply_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "supply_locations"
            referencedColumns: ["id"]
          },
        ]
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
          manager_override: boolean
          notes: string | null
          override_by: string | null
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
          manager_override?: boolean
          notes?: string | null
          override_by?: string | null
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
          manager_override?: boolean
          notes?: string | null
          override_by?: string | null
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
          {
            foreignKeyName: "time_entries_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
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
      user_custom_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
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
      profiles_directory: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string | null
          employee_id: string | null
          first_name: string | null
          id: string | null
          job_title: string | null
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          first_name?: string | null
          id?: string | null
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          employee_id?: string | null
          first_name?: string | null
          id?: string | null
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_job_site_sensitive_info: {
        Args: { _job_site_id: string; _user_id: string }
        Returns: boolean
      }
      can_message_user: {
        Args: { _recipient_id: string; _sender_id: string }
        Returns: boolean
      }
      compute_inspection_score: {
        Args: { p_inspection_id: string }
        Returns: undefined
      }
      create_announcement: {
        Args: { _audience?: string; _description: string; _name: string }
        Returns: string
      }
      create_group_conversation: {
        Args: {
          _account_id?: string
          _description: string
          _member_ids: string[]
          _name: string
        }
        Returns: string
      }
      delete_own_account: { Args: never; Returns: undefined }
      get_coworkers_at_shared_accounts: {
        Args: never
        Returns: {
          first_name: string
          id: string
          job_title: string
          last_name: string
        }[]
      }
      get_employee_department_managers: {
        Args: { p_employee_id: string }
        Returns: {
          manager_email: string
          manager_first_name: string
          manager_id: string
          manager_last_name: string
        }[]
      }
      get_employee_managers: {
        Args: { _employee_id: string }
        Returns: {
          manager_email: string
          manager_id: string
          manager_job_title: string
          manager_name: string
        }[]
      }
      get_job_site_public_name: {
        Args: { _job_site_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_my_conversations: {
        Args: never
        Returns: {
          account_id: string
          conversation_type: string
          created_by: string
          description: string
          id: string
          last_message_at: string
          name: string
          participant_count: number
          unread_count: number
        }[]
      }
      get_or_create_conversation: {
        Args: { _user1_id: string; _user2_id: string }
        Returns: string
      }
      get_user_all_permissions: {
        Args: { _user_id: string }
        Returns: {
          permission: Database["public"]["Enums"]["app_permission"]
        }[]
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
      initialize_monthly_budget: {
        Args: { _job_site_id: string }
        Returns: undefined
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_crm_user: { Args: { _user_id: string }; Returns: boolean }
      is_supply_manager: { Args: { _user_id: string }; Returns: boolean }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      regenerate_job_site_qr_token: {
        Args: { _job_site_id: string }
        Returns: string
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
      calendar_draft_kind: "shift_draft" | "event" | "holiday" | "note"
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
      calendar_draft_kind: ["shift_draft", "event", "holiday", "note"],
      time_off_status: ["pending", "approved", "declined"],
      work_order_photo_type: ["deficiency", "completion"],
      work_order_priority: ["low", "medium", "high", "urgent"],
      work_order_status: ["open", "in_progress", "completed", "reviewed"],
    },
  },
} as const
