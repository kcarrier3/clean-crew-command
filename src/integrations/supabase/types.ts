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
      adp_export_settings: {
        Row: {
          columns: Json
          created_at: string
          date_format: string
          id: string
          overtime_code: string
          regular_code: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          columns?: Json
          created_at?: string
          date_format?: string
          id?: string
          overtime_code?: string
          regular_code?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string
          date_format?: string
          id?: string
          overtime_code?: string
          regular_code?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adp_export_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adp_export_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
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
      assistant_api_clients: {
        Row: {
          actor_user_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_api_clients_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_api_clients_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_request_log: {
        Row: {
          action: string
          actor_user_id: string | null
          client_id: string | null
          created_at: string
          created_record_ids: Json | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          request_payload: Json | null
          response_payload: Json | null
          source: string
          status: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          created_record_ids?: Json | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          source?: string
          status?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          created_record_ids?: Json | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_request_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "assistant_api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_points: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          occurred_on: string
          point_type: string
          points: number
          recorded_by: string | null
          schedule_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          occurred_on: string
          point_type: string
          points?: number
          recorded_by?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          occurred_on?: string
          point_type?: string
          points?: number
          recorded_by?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_points_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_points_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_points_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_points_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_points_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "employee_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_account_preferences: {
        Row: {
          additional_recipients: string[]
          auto_send_allowed: boolean
          billing_contact_name: string | null
          billing_phone: string | null
          cc_recipients: string[]
          consolidated_invoicing: boolean
          created_at: string
          crm_company_id: string | null
          default_po_number: string | null
          default_terms: string | null
          delivery_method: string
          id: string
          notes: string | null
          po_required: boolean
          primary_billing_email: string | null
          reply_to_email: string | null
          special_instructions: string | null
          updated_at: string
        }
        Insert: {
          additional_recipients?: string[]
          auto_send_allowed?: boolean
          billing_contact_name?: string | null
          billing_phone?: string | null
          cc_recipients?: string[]
          consolidated_invoicing?: boolean
          created_at?: string
          crm_company_id?: string | null
          default_po_number?: string | null
          default_terms?: string | null
          delivery_method?: string
          id?: string
          notes?: string | null
          po_required?: boolean
          primary_billing_email?: string | null
          reply_to_email?: string | null
          special_instructions?: string | null
          updated_at?: string
        }
        Update: {
          additional_recipients?: string[]
          auto_send_allowed?: boolean
          billing_contact_name?: string | null
          billing_phone?: string | null
          cc_recipients?: string[]
          consolidated_invoicing?: boolean
          created_at?: string
          crm_company_id?: string | null
          default_po_number?: string | null
          default_terms?: string | null
          delivery_method?: string
          id?: string
          notes?: string | null
          po_required?: boolean
          primary_billing_email?: string | null
          reply_to_email?: string | null
          special_instructions?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_account_preferences_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: true
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_check_intake_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: Json
          event: string
          id: string
          intake_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
          intake_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          intake_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_check_intake_events_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "billing_check_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_check_intakes: {
        Row: {
          amount: number
          apply_mode: string | null
          auto_eligible: boolean
          blocked_reasons: Json
          check_date: string | null
          check_image_path: string | null
          check_number: string | null
          confidence: Json
          created_at: string
          created_by: string | null
          crm_company_id: string | null
          deposit_account_label: string | null
          deposit_date: string | null
          extraction: Json
          id: string
          notes: string | null
          payer_name: string | null
          payment_id: string | null
          processed_at: string | null
          processed_by: string | null
          proposed_allocations: Json
          received_date: string
          status: string
          stub_image_path: string | null
          updated_at: string
          warnings: Json
        }
        Insert: {
          amount?: number
          apply_mode?: string | null
          auto_eligible?: boolean
          blocked_reasons?: Json
          check_date?: string | null
          check_image_path?: string | null
          check_number?: string | null
          confidence?: Json
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          deposit_account_label?: string | null
          deposit_date?: string | null
          extraction?: Json
          id?: string
          notes?: string | null
          payer_name?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          proposed_allocations?: Json
          received_date?: string
          status?: string
          stub_image_path?: string | null
          updated_at?: string
          warnings?: Json
        }
        Update: {
          amount?: number
          apply_mode?: string | null
          auto_eligible?: boolean
          blocked_reasons?: Json
          check_date?: string | null
          check_image_path?: string | null
          check_number?: string | null
          confidence?: Json
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          deposit_account_label?: string | null
          deposit_date?: string | null
          extraction?: Json
          id?: string
          notes?: string | null
          payer_name?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          proposed_allocations?: Json
          received_date?: string
          status?: string
          stub_image_path?: string | null
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "billing_check_intakes_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_check_intakes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_deposit_batches: {
        Row: {
          bank_account_label: string | null
          created_at: string
          created_by: string | null
          deposit_date: string
          id: string
          name: string
          notes: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          bank_account_label?: string | null
          created_at?: string
          created_by?: string | null
          deposit_date?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          bank_account_label?: string | null
          created_at?: string
          created_by?: string | null
          deposit_date?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_email_messages: {
        Row: {
          attachment_path: string | null
          attachment_paths: string[]
          bcc_recipients: string[]
          body: string
          cc_recipients: string[]
          created_at: string
          created_by: string | null
          crm_company_id: string | null
          crm_lead_id: string | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          message_kind: string
          opened_at: string | null
          provider: string | null
          provider_message_id: string | null
          queued_at: string | null
          retry_count: number
          sent_at: string | null
          status: string
          subject: string
          template_key: string | null
          to_recipients: string[]
          updated_at: string
          webhook_at: string | null
          webhook_status: string | null
        }
        Insert: {
          attachment_path?: string | null
          attachment_paths?: string[]
          bcc_recipients?: string[]
          body?: string
          cc_recipients?: string[]
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_lead_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          message_kind?: string
          opened_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject?: string
          template_key?: string | null
          to_recipients?: string[]
          updated_at?: string
          webhook_at?: string | null
          webhook_status?: string | null
        }
        Update: {
          attachment_path?: string | null
          attachment_paths?: string[]
          bcc_recipients?: string[]
          body?: string
          cc_recipients?: string[]
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_lead_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          message_kind?: string
          opened_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject?: string
          template_key?: string | null
          to_recipients?: string[]
          updated_at?: string
          webhook_at?: string | null
          webhook_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_email_messages_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_email_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_email_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          key: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          key: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          key?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          amount: number
          billing_email: string | null
          billing_percent: number | null
          completed_at: string
          contract_amount: number | null
          created_at: string
          created_by: string | null
          crm_company_id: string | null
          crm_deal_id: string | null
          crm_lead_id: string | null
          description: string | null
          hold_at: string | null
          hold_by: string | null
          hold_reason: string | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          job_site_id: string | null
          label: string
          milestone_id: string | null
          notes: string | null
          po_number: string | null
          project_phase_id: string | null
          ready_at: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_email?: string | null
          billing_percent?: number | null
          completed_at?: string
          contract_amount?: number | null
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_deal_id?: string | null
          crm_lead_id?: string | null
          description?: string | null
          hold_at?: string | null
          hold_by?: string | null
          hold_reason?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          job_site_id?: string | null
          label: string
          milestone_id?: string | null
          notes?: string | null
          po_number?: string | null
          project_phase_id?: string | null
          ready_at?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_email?: string | null
          billing_percent?: number | null
          completed_at?: string
          contract_amount?: number | null
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_deal_id?: string | null
          crm_lead_id?: string | null
          description?: string | null
          hold_at?: string | null
          hold_by?: string | null
          hold_reason?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          job_site_id?: string | null
          label?: string
          milestone_id?: string | null
          notes?: string | null
          po_number?: string | null
          project_phase_id?: string | null
          ready_at?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_crm_deal_id_fkey"
            columns: ["crm_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "billing_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_project_phase_id_fkey"
            columns: ["project_phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoice_history: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          event_type: string
          from_status: string | null
          id: string
          invoice_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          from_status?: string | null
          id?: string
          invoice_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          from_status?: string | null
          id?: string
          invoice_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoice_items: {
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
            foreignKeyName: "billing_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_paid: number
          balance_due: number
          bill_to_address: string | null
          bill_to_city: string | null
          bill_to_name: string | null
          bill_to_state: string | null
          bill_to_zip: string | null
          billing_contact_name: string | null
          billing_email: string | null
          created_at: string
          created_by: string | null
          crm_company_id: string | null
          crm_deal_id: string | null
          crm_lead_id: string | null
          customer_name: string | null
          due_date: string | null
          earliest_completed_at: string | null
          email_count: number
          email_status: string | null
          generated_at: string
          id: string
          invoice_date: string
          invoice_number: string
          is_recurring: boolean
          job_site_id: string | null
          last_emailed_at: string | null
          notes: string | null
          online_paid_at: string | null
          online_payment_enabled: boolean
          paid_at: string | null
          payment_link_url: string | null
          payment_processor: string | null
          payment_terms: string | null
          pdf_path: string | null
          po_number: string | null
          processor_invoice_id: string | null
          processor_status: string | null
          qb_external_id: string | null
          qb_sync_error: string | null
          qb_sync_status: string
          qb_synced_at: string | null
          recurring_period_end: string | null
          recurring_period_start: string | null
          sent_at: string | null
          ship_to_address: string | null
          ship_to_city: string | null
          ship_to_name: string | null
          ship_to_state: string | null
          ship_to_zip: string | null
          status: string
          subtotal: number
          tax: number
          tax_jurisdiction: string | null
          tax_rate: number
          total: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          bill_to_address?: string | null
          bill_to_city?: string | null
          bill_to_name?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          billing_contact_name?: string | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_deal_id?: string | null
          crm_lead_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          earliest_completed_at?: string | null
          email_count?: number
          email_status?: string | null
          generated_at?: string
          id?: string
          invoice_date?: string
          invoice_number: string
          is_recurring?: boolean
          job_site_id?: string | null
          last_emailed_at?: string | null
          notes?: string | null
          online_paid_at?: string | null
          online_payment_enabled?: boolean
          paid_at?: string | null
          payment_link_url?: string | null
          payment_processor?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          po_number?: string | null
          processor_invoice_id?: string | null
          processor_status?: string | null
          qb_external_id?: string | null
          qb_sync_error?: string | null
          qb_sync_status?: string
          qb_synced_at?: string | null
          recurring_period_end?: string | null
          recurring_period_start?: string | null
          sent_at?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_name?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_jurisdiction?: string | null
          tax_rate?: number
          total?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          bill_to_address?: string | null
          bill_to_city?: string | null
          bill_to_name?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          billing_contact_name?: string | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_deal_id?: string | null
          crm_lead_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          earliest_completed_at?: string | null
          email_count?: number
          email_status?: string | null
          generated_at?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_recurring?: boolean
          job_site_id?: string | null
          last_emailed_at?: string | null
          notes?: string | null
          online_paid_at?: string | null
          online_payment_enabled?: boolean
          paid_at?: string | null
          payment_link_url?: string | null
          payment_processor?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          po_number?: string | null
          processor_invoice_id?: string | null
          processor_status?: string | null
          qb_external_id?: string | null
          qb_sync_error?: string | null
          qb_sync_status?: string
          qb_synced_at?: string | null
          recurring_period_end?: string | null
          recurring_period_start?: string | null
          sent_at?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_name?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_jurisdiction?: string | null
          tax_rate?: number
          total?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_crm_deal_id_fkey"
            columns: ["crm_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_milestones: {
        Row: {
          billing_amount: number | null
          billing_percent: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          job_site_id: string
          name: string
          notes: string | null
          sequence: number
          status: string
          updated_at: string
        }
        Insert: {
          billing_amount?: number | null
          billing_percent?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          job_site_id: string
          name: string
          notes?: string | null
          sequence?: number
          status?: string
          updated_at?: string
        }
        Update: {
          billing_amount?: number | null
          billing_percent?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          job_site_id?: string
          name?: string
          notes?: string | null
          sequence?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_milestones_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          created_at: string
          crm_company_id: string | null
          deposit_account_label: string | null
          deposit_batch_id: string | null
          deposit_date: string | null
          entered_by: string | null
          entry_source: string
          id: string
          method: string
          notes: string | null
          payer_name: string | null
          payment_date: string
          qb_external_id: string | null
          qb_sync_error: string | null
          qb_sync_status: string
          qb_synced_at: string | null
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          crm_company_id?: string | null
          deposit_account_label?: string | null
          deposit_batch_id?: string | null
          deposit_date?: string | null
          entered_by?: string | null
          entry_source?: string
          id?: string
          method?: string
          notes?: string | null
          payer_name?: string | null
          payment_date?: string
          qb_external_id?: string | null
          qb_sync_error?: string | null
          qb_sync_status?: string
          qb_synced_at?: string | null
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          crm_company_id?: string | null
          deposit_account_label?: string | null
          deposit_batch_id?: string | null
          deposit_date?: string | null
          entered_by?: string | null
          entry_source?: string
          id?: string
          method?: string
          notes?: string | null
          payer_name?: string | null
          payment_date?: string
          qb_external_id?: string | null
          qb_sync_error?: string | null
          qb_sync_status?: string
          qb_synced_at?: string | null
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_deposit_batch_id_fkey"
            columns: ["deposit_batch_id"]
            isOneToOne: false
            referencedRelation: "billing_deposit_batches"
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
          is_infrequent: boolean | null
          job_site_id: string | null
          kind: Database["public"]["Enums"]["calendar_draft_kind"]
          notes: string | null
          promoted_schedule_id: string | null
          series_id: string | null
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
          is_infrequent?: boolean | null
          job_site_id?: string | null
          kind?: Database["public"]["Enums"]["calendar_draft_kind"]
          notes?: string | null
          promoted_schedule_id?: string | null
          series_id?: string | null
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
          is_infrequent?: boolean | null
          job_site_id?: string | null
          kind?: Database["public"]["Enums"]["calendar_draft_kind"]
          notes?: string | null
          promoted_schedule_id?: string | null
          series_id?: string | null
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
          annual_revenue: number | null
          city: string | null
          created_at: string
          created_by: string | null
          employee_count: number | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          salesforce_id: string | null
          sf_created_date: string | null
          sf_last_modified_date: string | null
          sf_owner_id: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          salesforce_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          salesforce_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
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
          salesforce_id: string | null
          sf_created_date: string | null
          sf_last_modified_date: string | null
          sf_owner_id: string | null
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
          salesforce_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
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
          salesforce_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
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
          pipeline: string
          primary_contact_id: string | null
          probability: number | null
          sf_account_id: string | null
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
          pipeline?: string
          primary_contact_id?: string | null
          probability?: number | null
          sf_account_id?: string | null
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
          pipeline?: string
          primary_contact_id?: string | null
          probability?: number | null
          sf_account_id?: string | null
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
          body_missing: boolean
          company_id: string | null
          contact_id: string | null
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          lead_id: string | null
          parent_type: string | null
          salesforce_id: string | null
          sf_content_document_id: string | null
          sf_content_version_id: string | null
          sf_created_by_id: string | null
          sf_created_date: string | null
          sf_last_modified_date: string | null
          sf_owner_id: string | null
          sf_parent_id: string | null
          sf_source_object: string | null
          task_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          body_missing?: boolean
          company_id?: string | null
          contact_id?: string | null
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          lead_id?: string | null
          parent_type?: string | null
          salesforce_id?: string | null
          sf_content_document_id?: string | null
          sf_content_version_id?: string | null
          sf_created_by_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
          sf_parent_id?: string | null
          sf_source_object?: string | null
          task_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          body_missing?: boolean
          company_id?: string | null
          contact_id?: string | null
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          lead_id?: string | null
          parent_type?: string | null
          salesforce_id?: string | null
          sf_content_document_id?: string | null
          sf_content_version_id?: string | null
          sf_created_by_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
          sf_parent_id?: string | null
          sf_source_object?: string | null
          task_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_files_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_notes: {
        Row: {
          category: string
          company_id: string | null
          contact_id: string | null
          content: string
          content_html: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          parent_type: string | null
          salesforce_id: string | null
          sf_created_by_id: string | null
          sf_created_date: string | null
          sf_last_modified_date: string | null
          sf_owner_id: string | null
          sf_parent_id: string | null
          sf_source_object: string | null
          task_id: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          company_id?: string | null
          contact_id?: string | null
          content: string
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          parent_type?: string | null
          salesforce_id?: string | null
          sf_created_by_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
          sf_parent_id?: string | null
          sf_source_object?: string | null
          task_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          contact_id?: string | null
          content?: string
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          parent_type?: string | null
          salesforce_id?: string | null
          sf_created_by_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
          sf_parent_id?: string | null
          sf_source_object?: string | null
          task_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
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
          expected_revenue: number | null
          follow_up: boolean
          id: string
          lead_source: string | null
          lost_at: string | null
          lost_competitor: string | null
          lost_notes: string | null
          lost_reason: string | null
          name: string | null
          next_step: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          pipeline: string
          primary_contact_id: string | null
          probability: number | null
          salesforce_id: string | null
          service_line: string | null
          sf_account_id: string | null
          sf_account_name: string | null
          sf_created_date: string | null
          sf_last_modified_date: string | null
          sf_owner_id: string | null
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
          expected_revenue?: number | null
          follow_up?: boolean
          id?: string
          lead_source?: string | null
          lost_at?: string | null
          lost_competitor?: string | null
          lost_notes?: string | null
          lost_reason?: string | null
          name?: string | null
          next_step?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          pipeline?: string
          primary_contact_id?: string | null
          probability?: number | null
          salesforce_id?: string | null
          service_line?: string | null
          sf_account_id?: string | null
          sf_account_name?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
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
          expected_revenue?: number | null
          follow_up?: boolean
          id?: string
          lead_source?: string | null
          lost_at?: string | null
          lost_competitor?: string | null
          lost_notes?: string | null
          lost_reason?: string | null
          name?: string | null
          next_step?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          pipeline?: string
          primary_contact_id?: string | null
          probability?: number | null
          salesforce_id?: string | null
          service_line?: string | null
          sf_account_id?: string | null
          sf_account_name?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
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
          pipeline: string
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
          pipeline?: string
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
          pipeline?: string
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
          salesforce_id: string | null
          sf_created_by_id: string | null
          sf_created_date: string | null
          sf_last_modified_date: string | null
          sf_owner_id: string | null
          sf_priority: string | null
          sf_status: string | null
          sf_what_id: string | null
          sf_who_id: string | null
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
          salesforce_id?: string | null
          sf_created_by_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
          sf_priority?: string | null
          sf_status?: string | null
          sf_what_id?: string | null
          sf_who_id?: string | null
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
          salesforce_id?: string | null
          sf_created_by_id?: string | null
          sf_created_date?: string | null
          sf_last_modified_date?: string | null
          sf_owner_id?: string | null
          sf_priority?: string | null
          sf_status?: string | null
          sf_what_id?: string | null
          sf_who_id?: string | null
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
          employee_id: string | null
          end_date: string | null
          end_time: string | null
          id: string
          job_site_id: string
          notes: string | null
          recurrence_anchor_date: string | null
          start_date: string
          start_time: string | null
          updated_at: string
          week_interval: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          employee_id?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          job_site_id: string
          notes?: string | null
          recurrence_anchor_date?: string | null
          start_date: string
          start_time?: string | null
          updated_at?: string
          week_interval?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          employee_id?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          job_site_id?: string
          notes?: string | null
          recurrence_anchor_date?: string | null
          start_date?: string
          start_time?: string | null
          updated_at?: string
          week_interval?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
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
      estimate_line_adders: {
        Row: {
          cost: number
          created_at: string
          description: string
          frequency: string
          hours: number
          id: string
          kind: string
          price: number
          revision_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description: string
          frequency?: string
          hours?: number
          id?: string
          kind?: string
          price?: number
          revision_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          frequency?: string
          hours?: number
          id?: string
          kind?: string
          price?: number
          revision_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_adders_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "estimate_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_production_rates: {
        Row: {
          active: boolean
          area_type: string
          building_type: string
          created_at: string
          id: string
          notes: string | null
          sqft_per_hour: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_type?: string
          building_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          sqft_per_hour?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_type?: string
          building_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          sqft_per_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      estimate_proposals: {
        Row: {
          accepted_at: string | null
          bill_to_address: string | null
          bill_to_city: string | null
          bill_to_name: string | null
          bill_to_state: string | null
          bill_to_zip: string | null
          company_id: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          customer_contact_name: string | null
          customer_email: string | null
          customer_name: string | null
          declined_at: string | null
          estimate_id: string | null
          id: string
          intro: string | null
          invoice_id: string | null
          lead_id: string | null
          lines: Json
          period_label: string
          proposal_number: string
          revision_id: string | null
          sent_at: string | null
          ship_to_address: string | null
          ship_to_city: string | null
          ship_to_name: string | null
          ship_to_state: string | null
          ship_to_zip: string | null
          status: string
          subtotal: number
          tax: number
          tax_jurisdiction: string | null
          tax_rate: number
          terms: string | null
          title: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          bill_to_address?: string | null
          bill_to_city?: string | null
          bill_to_name?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          company_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_contact_name?: string | null
          customer_email?: string | null
          customer_name?: string | null
          declined_at?: string | null
          estimate_id?: string | null
          id?: string
          intro?: string | null
          invoice_id?: string | null
          lead_id?: string | null
          lines?: Json
          period_label?: string
          proposal_number?: string
          revision_id?: string | null
          sent_at?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_name?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_jurisdiction?: string | null
          tax_rate?: number
          terms?: string | null
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          bill_to_address?: string | null
          bill_to_city?: string | null
          bill_to_name?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          company_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_contact_name?: string | null
          customer_email?: string | null
          customer_name?: string | null
          declined_at?: string | null
          estimate_id?: string | null
          id?: string
          intro?: string | null
          invoice_id?: string | null
          lead_id?: string | null
          lines?: Json
          period_label?: string
          proposal_number?: string
          revision_id?: string | null
          sent_at?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_name?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_jurisdiction?: string | null
          tax_rate?: number
          terms?: string | null
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_proposals_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_proposals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_proposals_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "estimate_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_revisions: {
        Row: {
          annual_price: number
          base_monthly_price: number
          base_wage: number
          building_type: string | null
          cleanings_per_week: number
          created_at: string
          created_by: string | null
          day_porter_hours_per_week: number
          estimate_id: string
          fixture_count: number
          floor_mix: Json
          gross_margin_percent: number
          id: string
          labor_burden_percent: number
          labor_hours_per_visit: number
          labor_hours_per_visit_override: number
          loaded_labor_rate: number
          markup_percent: number
          minimum_visit_minutes: number
          monthly_labor_cost: number
          monthly_labor_hours: number
          monthly_price: number
          monthly_supply_cost: number
          notes: string | null
          occupancy_level: string | null
          overhead_amount: number
          overhead_percent: number
          periodic_floor_care: Json
          periodic_floor_care_amount: number
          periodic_floor_care_percent: number
          price_per_sqft: number
          price_per_visit: number
          pricing_mode: string
          production_rate_sqft_hour: number
          project_direct_cost: number | null
          project_labor_hours: number | null
          project_price: number | null
          restroom_count: number
          revision_number: number
          service_type: string
          service_window: string
          specialty_inputs: Json
          square_feet: number
          status: string
          supervision_amount: number
          supervision_percent: number
          supply_preset: string
          supply_rate_per_hour: number
          target_margin_percent: number
          total_direct_cost: number
          traffic_level: string | null
          updated_at: string
          weeks_per_month: number
          windows_hours_per_month: number
        }
        Insert: {
          annual_price?: number
          base_monthly_price?: number
          base_wage?: number
          building_type?: string | null
          cleanings_per_week?: number
          created_at?: string
          created_by?: string | null
          day_porter_hours_per_week?: number
          estimate_id: string
          fixture_count?: number
          floor_mix?: Json
          gross_margin_percent?: number
          id?: string
          labor_burden_percent?: number
          labor_hours_per_visit?: number
          labor_hours_per_visit_override?: number
          loaded_labor_rate?: number
          markup_percent?: number
          minimum_visit_minutes?: number
          monthly_labor_cost?: number
          monthly_labor_hours?: number
          monthly_price?: number
          monthly_supply_cost?: number
          notes?: string | null
          occupancy_level?: string | null
          overhead_amount?: number
          overhead_percent?: number
          periodic_floor_care?: Json
          periodic_floor_care_amount?: number
          periodic_floor_care_percent?: number
          price_per_sqft?: number
          price_per_visit?: number
          pricing_mode?: string
          production_rate_sqft_hour?: number
          project_direct_cost?: number | null
          project_labor_hours?: number | null
          project_price?: number | null
          restroom_count?: number
          revision_number?: number
          service_type?: string
          service_window?: string
          specialty_inputs?: Json
          square_feet?: number
          status?: string
          supervision_amount?: number
          supervision_percent?: number
          supply_preset?: string
          supply_rate_per_hour?: number
          target_margin_percent?: number
          total_direct_cost?: number
          traffic_level?: string | null
          updated_at?: string
          weeks_per_month?: number
          windows_hours_per_month?: number
        }
        Update: {
          annual_price?: number
          base_monthly_price?: number
          base_wage?: number
          building_type?: string | null
          cleanings_per_week?: number
          created_at?: string
          created_by?: string | null
          day_porter_hours_per_week?: number
          estimate_id?: string
          fixture_count?: number
          floor_mix?: Json
          gross_margin_percent?: number
          id?: string
          labor_burden_percent?: number
          labor_hours_per_visit?: number
          labor_hours_per_visit_override?: number
          loaded_labor_rate?: number
          markup_percent?: number
          minimum_visit_minutes?: number
          monthly_labor_cost?: number
          monthly_labor_hours?: number
          monthly_price?: number
          monthly_supply_cost?: number
          notes?: string | null
          occupancy_level?: string | null
          overhead_amount?: number
          overhead_percent?: number
          periodic_floor_care?: Json
          periodic_floor_care_amount?: number
          periodic_floor_care_percent?: number
          price_per_sqft?: number
          price_per_visit?: number
          pricing_mode?: string
          production_rate_sqft_hour?: number
          project_direct_cost?: number | null
          project_labor_hours?: number | null
          project_price?: number | null
          restroom_count?: number
          revision_number?: number
          service_type?: string
          service_window?: string
          specialty_inputs?: Json
          square_feet?: number
          status?: string
          supervision_amount?: number
          supervision_percent?: number
          supply_preset?: string
          supply_rate_per_hour?: number
          target_margin_percent?: number
          total_direct_cost?: number
          traffic_level?: string | null
          updated_at?: string
          weeks_per_month?: number
          windows_hours_per_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_revisions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_settings: {
        Row: {
          base_wage: number
          created_at: string
          default_overhead_percent: number
          default_production_rate: number
          default_target_margin_percent: number
          id: string
          labor_burden_percent: number
          supply_high: number
          supply_low: number
          supply_standard: number
          updated_at: string
          updated_by: string | null
          weeks_per_month: number
        }
        Insert: {
          base_wage?: number
          created_at?: string
          default_overhead_percent?: number
          default_production_rate?: number
          default_target_margin_percent?: number
          id?: string
          labor_burden_percent?: number
          supply_high?: number
          supply_low?: number
          supply_standard?: number
          updated_at?: string
          updated_by?: string | null
          weeks_per_month?: number
        }
        Update: {
          base_wage?: number
          created_at?: string
          default_overhead_percent?: number
          default_production_rate?: number
          default_target_margin_percent?: number
          id?: string
          labor_burden_percent?: number
          supply_high?: number
          supply_low?: number
          supply_standard?: number
          updated_at?: string
          updated_by?: string | null
          weeks_per_month?: number
        }
        Relationships: []
      }
      estimates: {
        Row: {
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          converted_at: string | null
          converted_job_site_id: string | null
          created_at: string
          created_by: string | null
          current_revision_id: string | null
          id: string
          job_site_id: string | null
          lead_id: string
          name: string
          owner_id: string | null
          service_type: string
          source: string | null
          source_metadata: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          converted_at?: string | null
          converted_job_site_id?: string | null
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          job_site_id?: string | null
          lead_id: string
          name: string
          owner_id?: string | null
          service_type?: string
          source?: string | null
          source_metadata?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          converted_at?: string | null
          converted_job_site_id?: string | null
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          id?: string
          job_site_id?: string | null
          lead_id?: string
          name?: string
          owner_id?: string | null
          service_type?: string
          source?: string | null
          source_metadata?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_converted_job_site_id_fkey"
            columns: ["converted_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_current_revision_fk"
            columns: ["current_revision_id"]
            isOneToOne: false
            referencedRelation: "estimate_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      excused_shifts: {
        Row: {
          created_at: string
          employee_id: string
          excused_date: string
          granted_by: string | null
          id: string
          reason: string | null
          schedule_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          excused_date: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          excused_date?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excused_shifts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "employee_schedules"
            referencedColumns: ["id"]
          },
        ]
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
          billing_acknowledged_at: string | null
          billing_acknowledged_by: string | null
          billing_contact_name: string | null
          billing_email: string | null
          billing_mode: string
          billing_notes: string | null
          billing_po_number: string | null
          billing_terms: string | null
          budget_info: string | null
          budgeted_hours: number | null
          city: string | null
          client_name: string | null
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          completion_status: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contract_amount: number | null
          created_at: string
          crm_company_id: string | null
          crm_deal_id: string | null
          crm_lead_id: string | null
          current_month_used_hours: number | null
          current_month_year: string | null
          estimated_duration: string | null
          id: string
          is_office: boolean
          is_phased: boolean
          is_recurring_monthly: boolean | null
          job_cost_code: string | null
          last_reset_date: string | null
          location_code: string | null
          name: string
          nightly_hours: number | null
          postal_code: string | null
          project_manager: string | null
          qr_code_token: string
          remaining_hours: number | null
          safety_requirements: string | null
          service_days: number[]
          special_instructions: string | null
          state: string | null
          tax_jurisdiction: string | null
          tm_hours: number
          updated_at: string
          used_hours: number | null
        }
        Insert: {
          access_instructions?: string | null
          active?: boolean
          address?: string | null
          billing_acknowledged_at?: string | null
          billing_acknowledged_by?: string | null
          billing_contact_name?: string | null
          billing_email?: string | null
          billing_mode?: string
          billing_notes?: string | null
          billing_po_number?: string | null
          billing_terms?: string | null
          budget_info?: string | null
          budgeted_hours?: number | null
          city?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          completion_status?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_amount?: number | null
          created_at?: string
          crm_company_id?: string | null
          crm_deal_id?: string | null
          crm_lead_id?: string | null
          current_month_used_hours?: number | null
          current_month_year?: string | null
          estimated_duration?: string | null
          id?: string
          is_office?: boolean
          is_phased?: boolean
          is_recurring_monthly?: boolean | null
          job_cost_code?: string | null
          last_reset_date?: string | null
          location_code?: string | null
          name: string
          nightly_hours?: number | null
          postal_code?: string | null
          project_manager?: string | null
          qr_code_token?: string
          remaining_hours?: number | null
          safety_requirements?: string | null
          service_days?: number[]
          special_instructions?: string | null
          state?: string | null
          tax_jurisdiction?: string | null
          tm_hours?: number
          updated_at?: string
          used_hours?: number | null
        }
        Update: {
          access_instructions?: string | null
          active?: boolean
          address?: string | null
          billing_acknowledged_at?: string | null
          billing_acknowledged_by?: string | null
          billing_contact_name?: string | null
          billing_email?: string | null
          billing_mode?: string
          billing_notes?: string | null
          billing_po_number?: string | null
          billing_terms?: string | null
          budget_info?: string | null
          budgeted_hours?: number | null
          city?: string | null
          client_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          completion_status?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_amount?: number | null
          created_at?: string
          crm_company_id?: string | null
          crm_deal_id?: string | null
          crm_lead_id?: string | null
          current_month_used_hours?: number | null
          current_month_year?: string | null
          estimated_duration?: string | null
          id?: string
          is_office?: boolean
          is_phased?: boolean
          is_recurring_monthly?: boolean | null
          job_cost_code?: string | null
          last_reset_date?: string | null
          location_code?: string | null
          name?: string
          nightly_hours?: number | null
          postal_code?: string | null
          project_manager?: string | null
          qr_code_token?: string
          remaining_hours?: number | null
          safety_requirements?: string | null
          service_days?: number[]
          special_instructions?: string | null
          state?: string | null
          tax_jurisdiction?: string | null
          tm_hours?: number
          updated_at?: string
          used_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sites_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_crm_deal_id_fkey"
            columns: ["crm_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
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
      paid_holidays: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          paid_only_if_weekday: boolean
          rule: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          paid_only_if_weekday?: boolean
          rule: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          paid_only_if_weekday?: boolean
          rule?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_export_batches: {
        Row: {
          created_at: string
          exported_at: string
          exported_by: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          row_count: number
          total_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          exported_at?: string
          exported_by?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          row_count?: number
          total_hours?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          exported_at?: string
          exported_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          row_count?: number
          total_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_export_batches_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_export_batches_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_export_rows: {
        Row: {
          adp_file_number: string | null
          batch_id: string
          city: string | null
          created_at: string
          crew_compass_employee_code: string | null
          department_code: string | null
          earnings_code: string
          employee_id: string | null
          employee_name: string
          hourly_rate: number | null
          id: string
          job_cost_code: string | null
          job_name: string | null
          job_site_id: string | null
          location_code: string | null
          overtime_hours: number
          regular_hours: number
          state: string | null
          tax_jurisdiction: string | null
          total_hours: number
          work_date: string
        }
        Insert: {
          adp_file_number?: string | null
          batch_id: string
          city?: string | null
          created_at?: string
          crew_compass_employee_code?: string | null
          department_code?: string | null
          earnings_code?: string
          employee_id?: string | null
          employee_name: string
          hourly_rate?: number | null
          id?: string
          job_cost_code?: string | null
          job_name?: string | null
          job_site_id?: string | null
          location_code?: string | null
          overtime_hours?: number
          regular_hours?: number
          state?: string | null
          tax_jurisdiction?: string | null
          total_hours?: number
          work_date: string
        }
        Update: {
          adp_file_number?: string | null
          batch_id?: string
          city?: string | null
          created_at?: string
          crew_compass_employee_code?: string | null
          department_code?: string | null
          earnings_code?: string
          employee_id?: string | null
          employee_name?: string
          hourly_rate?: number | null
          id?: string
          job_cost_code?: string | null
          job_name?: string | null
          job_site_id?: string | null
          location_code?: string | null
          overtime_hours?: number
          regular_hours?: number
          state?: string | null
          tax_jurisdiction?: string | null
          total_hours?: number
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_export_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_export_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_export_rows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_export_rows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_export_rows_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
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
          adp_department_code: string | null
          adp_file_number: string | null
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
          adp_department_code?: string | null
          adp_file_number?: string | null
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
          adp_department_code?: string | null
          adp_file_number?: string | null
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
      project_phases: {
        Row: {
          billing_acknowledged_at: string | null
          billing_acknowledged_by: string | null
          billing_amount: number | null
          billing_percent: number | null
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string
          id: string
          job_site_id: string
          name: string
          sequence: number
          status: string
          updated_at: string
        }
        Insert: {
          billing_acknowledged_at?: string | null
          billing_acknowledged_by?: string | null
          billing_amount?: number | null
          billing_percent?: number | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          id?: string
          job_site_id: string
          name: string
          sequence?: number
          status?: string
          updated_at?: string
        }
        Update: {
          billing_acknowledged_at?: string | null
          billing_acknowledged_by?: string | null
          billing_amount?: number | null
          billing_percent?: number | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          id?: string
          job_site_id?: string
          name?: string
          sequence?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pto_adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          employee_id: string
          hours: number
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          employee_id: string
          hours: number
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          employee_id?: string
          hours?: number
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pto_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pto_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      pto_tiers: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          weeks: number
          years_of_service: number
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          weeks: number
          years_of_service: number
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          weeks?: number
          years_of_service?: number
        }
        Relationships: []
      }
      radio_transmissions: {
        Row: {
          audio_path: string
          created_at: string
          duration_seconds: number
          id: string
          job_site_id: string
          sender_id: string
        }
        Insert: {
          audio_path: string
          created_at?: string
          duration_seconds?: number
          id?: string
          job_site_id: string
          sender_id: string
        }
        Update: {
          audio_path?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          job_site_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_transmissions_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_transmissions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_transmissions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_billing_periods: {
        Row: {
          amount: number | null
          created_at: string
          generated_at: string | null
          generated_by: string | null
          id: string
          invoice_id: string | null
          job_site_id: string
          period_end: string
          period_start: string
          reason: string | null
          schedule_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_id?: string | null
          job_site_id: string
          period_end: string
          period_start: string
          reason?: string | null
          schedule_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_id?: string | null
          job_site_id?: string
          period_end?: string
          period_start?: string
          reason?: string | null
          schedule_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_billing_periods_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_billing_periods_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_billing_periods_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_billing_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_billing_schedules: {
        Row: {
          active: boolean
          amount: number
          billing_contact_name: string | null
          billing_day: number
          billing_day_rule: string
          billing_email: string | null
          created_at: string
          created_by: string | null
          crm_company_id: string | null
          crm_deal_id: string | null
          frequency: string
          id: string
          invoice_description: string | null
          job_site_id: string
          next_invoice_date: string | null
          notes: string | null
          payment_terms: string | null
          po_number: string | null
          po_required: boolean
          service_period: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          billing_contact_name?: string | null
          billing_day?: number
          billing_day_rule?: string
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_deal_id?: string | null
          frequency?: string
          id?: string
          invoice_description?: string | null
          job_site_id: string
          next_invoice_date?: string | null
          notes?: string | null
          payment_terms?: string | null
          po_number?: string | null
          po_required?: boolean
          service_period?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          billing_contact_name?: string | null
          billing_day?: number
          billing_day_rule?: string
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          crm_company_id?: string | null
          crm_deal_id?: string | null
          frequency?: string
          id?: string
          invoice_description?: string | null
          job_site_id?: string
          next_invoice_date?: string | null
          notes?: string | null
          payment_terms?: string | null
          po_number?: string | null
          po_required?: boolean
          service_period?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_billing_schedules_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_billing_schedules_crm_deal_id_fkey"
            columns: ["crm_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_billing_schedules_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: true
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
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
      schedule_weeks: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          published: boolean
          published_at: string | null
          published_by: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          published?: boolean
          published_at?: string | null
          published_by?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          published?: boolean
          published_at?: string | null
          published_by?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      shift_call_offs: {
        Row: {
          call_off_date: string
          created_at: string
          employee_id: string
          id: string
          point_id: string | null
          reason: string | null
          recorded_by: string | null
          schedule_id: string
          updated_at: string
        }
        Insert: {
          call_off_date: string
          created_at?: string
          employee_id: string
          id?: string
          point_id?: string | null
          reason?: string | null
          recorded_by?: string | null
          schedule_id: string
          updated_at?: string
        }
        Update: {
          call_off_date?: string
          created_at?: string
          employee_id?: string
          id?: string
          point_id?: string | null
          reason?: string | null
          recorded_by?: string | null
          schedule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_call_offs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_call_offs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_call_offs_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "attendance_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_call_offs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_call_offs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_call_offs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "employee_schedules"
            referencedColumns: ["id"]
          },
        ]
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
      supply_item_cost_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          item_id: string
          new_markup_percent: number | null
          new_sale_price: number | null
          new_unit_cost: number | null
          note: string | null
          previous_markup_percent: number | null
          previous_sale_price: number | null
          previous_unit_cost: number | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          item_id: string
          new_markup_percent?: number | null
          new_sale_price?: number | null
          new_unit_cost?: number | null
          note?: string | null
          previous_markup_percent?: number | null
          previous_sale_price?: number | null
          previous_unit_cost?: number | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          item_id?: string
          new_markup_percent?: number | null
          new_sale_price?: number | null
          new_unit_cost?: number | null
          note?: string | null
          previous_markup_percent?: number | null
          previous_sale_price?: number | null
          previous_unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_item_cost_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "supply_items"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_items: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          kind: string
          markup_percent: number
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
          markup_percent?: number
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
          markup_percent?: number
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
          billing_event_id: string | null
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
          billing_event_id?: string | null
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
          billing_event_id?: string | null
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
            foreignKeyName: "supply_movements_billing_event_id_fkey"
            columns: ["billing_event_id"]
            isOneToOne: false
            referencedRelation: "billing_events"
            referencedColumns: ["id"]
          },
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
      tax_rates: {
        Row: {
          active: boolean
          city: string | null
          country: string
          county: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          label: string | null
          rate: number
          state: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          country?: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          rate?: number
          state: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          country?: string
          county?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          rate?: number
          state?: string
          updated_at?: string
          zip?: string | null
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
          exceeded_scheduled: boolean
          id: string
          job_site_id: string | null
          location_lat: number | null
          location_lng: number | null
          manager_override: boolean
          notes: string | null
          override_by: string | null
          schedule_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number | null
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          exceeded_scheduled?: boolean
          id?: string
          job_site_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          manager_override?: boolean
          notes?: string | null
          override_by?: string | null
          schedule_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          exceeded_scheduled?: boolean
          id?: string
          job_site_id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          manager_override?: boolean
          notes?: string | null
          override_by?: string | null
          schedule_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
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
          {
            foreignKeyName: "time_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "employee_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_policies: {
        Row: {
          auto_approve: boolean
          created_at: string
          department: string
          id: string
          max_off_per_day: number
          updated_at: string
        }
        Insert: {
          auto_approve?: boolean
          created_at?: string
          department: string
          id?: string
          max_off_per_day?: number
          updated_at?: string
        }
        Update: {
          auto_approve?: boolean
          created_at?: string
          department?: string
          id?: string
          max_off_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          auto_approved: boolean
          created_at: string
          employee_id: string
          end_date: string
          id: string
          manager_notes: string | null
          pto_hours: number
          reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["time_off_status"]
          updated_at: string
          use_pto: boolean
        }
        Insert: {
          auto_approved?: boolean
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          manager_notes?: string | null
          pto_hours?: number
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["time_off_status"]
          updated_at?: string
          use_pto?: boolean
        }
        Update: {
          auto_approved?: boolean
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          manager_notes?: string | null
          pto_hours?: number
          reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["time_off_status"]
          updated_at?: string
          use_pto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_ticket_hours: {
        Row: {
          created_at: string
          employee_id: string | null
          hours: number
          id: string
          notes: string | null
          ticket_id: string
          time_entry_id: string | null
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          hours?: number
          id?: string
          notes?: string | null
          ticket_id: string
          time_entry_id?: string | null
          updated_at?: string
          work_date?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          hours?: number
          id?: string
          notes?: string | null
          ticket_id?: string
          time_entry_id?: string | null
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_ticket_hours_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_ticket_hours_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_ticket_hours_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tm_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_ticket_hours_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_tickets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          customer_name: string | null
          customer_signature_data: string | null
          customer_signed_at: string | null
          description: string | null
          id: string
          job_site_id: string
          rejection_reason: string | null
          status: string
          ticket_number: string | null
          title: string
          total_hours: number
          updated_at: string
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string | null
          customer_signature_data?: string | null
          customer_signed_at?: string | null
          description?: string | null
          id?: string
          job_site_id: string
          rejection_reason?: string | null
          status?: string
          ticket_number?: string | null
          title: string
          total_hours?: number
          updated_at?: string
          work_date?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string | null
          customer_signature_data?: string | null
          customer_signed_at?: string | null
          description?: string | null
          id?: string
          job_site_id?: string
          rejection_reason?: string | null
          status?: string
          ticket_number?: string | null
          title?: string
          total_hours?: number
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_tickets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tickets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tickets_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
        ]
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
      user_tour_progress: {
        Row: {
          id: string
          module_key: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          module_key: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          module_key?: string
          seen_at?: string
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
      can_approve_estimate: { Args: { _user_id: string }; Returns: boolean }
      can_approve_tm_tickets: { Args: { _user_id: string }; Returns: boolean }
      can_estimate: { Args: { _user_id: string }; Returns: boolean }
      can_manage_billing: { Args: { _user_id: string }; Returns: boolean }
      can_manage_tm_tickets: { Args: { _user_id: string }; Returns: boolean }
      can_message_user: {
        Args: { _recipient_id: string; _sender_id: string }
        Returns: boolean
      }
      can_publish_schedules: { Args: { _user_id: string }; Returns: boolean }
      can_run_payroll: { Args: { _user_id: string }; Returns: boolean }
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
      get_pto_summary: {
        Args: { _as_of?: string; _employee_id: string }
        Returns: {
          adjustment_hours: number
          avg_weekly_hours: number
          eligible: boolean
          employee_id: string
          entitled_hours: number
          hire_date: string
          remaining_hours: number
          used_hours: number
          weeks: number
          year_end: string
          year_start: string
          years_of_service: number
        }[]
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
      is_pto_manager_title: { Args: { _job_title: string }; Returns: boolean }
      is_punched_in_at: {
        Args: { _job_site_id: string; _user_id: string }
        Returns: boolean
      }
      is_supply_manager: { Args: { _user_id: string }; Returns: boolean }
      manager_can_view_profile: {
        Args: { _employee_id: string; _manager_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      monthly_hours_from_nightly: {
        Args: { _month: string; _nightly: number; _service_days: number[] }
        Returns: number
      }
      next_invoice_number: { Args: never; Returns: string }
      next_proposal_number: { Args: never; Returns: string }
      recalc_invoice_balance: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      regenerate_job_site_qr_token: {
        Args: { _job_site_id: string }
        Returns: string
      }
      time_off_department: { Args: { _job_title: string }; Returns: string }
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
        | "view_crm"
        | "view_supplies"
        | "use_estimating"
        | "view_team_directory"
        | "view_calendar"
        | "use_messaging"
        | "publish_schedules"
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
        "view_crm",
        "view_supplies",
        "use_estimating",
        "view_team_directory",
        "view_calendar",
        "use_messaging",
        "publish_schedules",
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
