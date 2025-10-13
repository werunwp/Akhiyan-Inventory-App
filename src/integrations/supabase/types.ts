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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      business_settings: {
        Row: {
          address: string | null
          address_line1: string | null
          address_line2: string | null
          brand_color: string | null
          business_hours: string | null
          business_name: string
          created_at: string
          created_by: string | null
          email: string | null
          facebook: string | null
          id: string
          invoice_footer_message: string | null
          invoice_prefix: string | null
          logo_url: string | null
          phone: string | null
          primary_email: string | null
          secondary_email: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          brand_color?: string | null
          business_hours?: string | null
          business_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          invoice_footer_message?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_email?: string | null
          secondary_email?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          brand_color?: string | null
          business_hours?: string | null
          business_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          invoice_footer_message?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_email?: string | null
          secondary_email?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      courier_webhook_settings: {
        Row: {
          auth_password: string | null
          auth_username: string | null
          created_at: string
          id: string
          is_active: boolean
          status_check_webhook_url: string
          updated_at: string
          webhook_description: string | null
          webhook_name: string
          webhook_url: string
        }
        Insert: {
          auth_password?: string | null
          auth_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          status_check_webhook_url?: string
          updated_at?: string
          webhook_description?: string | null
          webhook_name?: string
          webhook_url: string
        }
        Update: {
          auth_password?: string | null
          auth_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          status_check_webhook_url?: string
          updated_at?: string
          webhook_description?: string | null
          webhook_name?: string
          webhook_url?: string
        }
        Relationships: []
      }
      custom_settings: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_enabled: boolean
          setting_type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          setting_type: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          setting_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          additional_info: string | null
          id: string
          last_purchase_date: string | null
          name: string
          order_count: number | null
          phone: string | null
          status: string | null
          tags: string[] | null
          total_spent: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          additional_info?: string | null
          id?: string
          last_purchase_date?: string | null
          name: string
          order_count?: number | null
          phone?: string | null
          status?: string | null
          tags?: string[] | null
          total_spent?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          additional_info?: string | null
          id?: string
          last_purchase_date?: string | null
          name?: string
          order_count?: number | null
          phone?: string | null
          status?: string | null
          tags?: string[] | null
          total_spent?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      dismissed_alerts: {
        Row: {
          alert_id: string
          created_at: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_logs: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          type: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          type: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          type?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          attribute_id: string
          created_at: string
          id: string
          value: string
        }
        Insert: {
          attribute_id: string
          created_at?: string
          id?: string
          value: string
        }
        Update: {
          attribute_id?: string
          created_at?: string
          id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "product_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          cost: number | null
          created_at: string
          id: string
          image_url: string | null
          last_synced_at: string | null
          low_stock_threshold: number | null
          product_id: string
          rate: number | null
          sku: string | null
          stock_quantity: number
          updated_at: string
          woocommerce_connection_id: string | null
          woocommerce_id: number | null
        }
        Insert: {
          attributes: Json
          cost?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          product_id: string
          rate?: number | null
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
          woocommerce_connection_id?: string | null
          woocommerce_id?: number | null
        }
        Update: {
          attributes?: Json
          cost?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          product_id?: string
          rate?: number | null
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
          woocommerce_connection_id?: string | null
          woocommerce_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_woocommerce_connection_id_fkey"
            columns: ["woocommerce_connection_id"]
            isOneToOne: false
            referencedRelation: "woocommerce_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          color: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          is_deleted: boolean
          last_synced_at: string | null
          low_stock_threshold: number | null
          name: string
          rate: number
          size: string | null
          sku: string | null
          stock_quantity: number | null
          updated_at: string | null
          woocommerce_connection_id: string | null
          woocommerce_id: number | null
        }
        Insert: {
          color?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          name: string
          rate: number
          size?: string | null
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          woocommerce_connection_id?: string | null
          woocommerce_id?: number | null
        }
        Update: {
          color?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          name?: string
          rate?: number
          size?: string | null
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          woocommerce_connection_id?: string | null
          woocommerce_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_woocommerce_connection_id_fkey"
            columns: ["woocommerce_connection_id"]
            isOneToOne: false
            referencedRelation: "woocommerce_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          area: string | null
          city: string | null
          consignment_id: string | null
          courier_status: string | null
          created_at: string | null
          created_by: string | null
          customer_address: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          customer_whatsapp: string | null
          discount_amount: number | null
          discount_percent: number | null
          grand_total: number
          id: string
          invoice_number: string
          last_status_check: string | null
          order_status: string | null
          payment_method: string
          subtotal: number
          updated_at: string | null
          zone: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          area?: string | null
          city?: string | null
          consignment_id?: string | null
          courier_status?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          grand_total: number
          id?: string
          invoice_number: string
          last_status_check?: string | null
          order_status?: string | null
          payment_method: string
          subtotal: number
          updated_at?: string | null
          zone?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          area?: string | null
          city?: string | null
          consignment_id?: string | null
          courier_status?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          grand_total?: number
          id?: string
          invoice_number?: string
          last_status_check?: string | null
          order_status?: string | null
          payment_method?: string
          subtotal?: number
          updated_at?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
          sale_id: string
          total: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
          sale_id: string
          total: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          rate?: number
          sale_id?: string
          total?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          currency_code: string
          currency_symbol: string
          date_format: string
          id: string
          time_format: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          date_format?: string
          id?: string
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          date_format?: string
          id?: string
          time_format?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          compact_view: boolean
          created_at: string
          dark_mode: boolean
          email_notifications: boolean
          id: string
          low_stock_alerts: boolean
          sales_reports: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          compact_view?: boolean
          created_at?: string
          dark_mode?: boolean
          email_notifications?: boolean
          id?: string
          low_stock_alerts?: boolean
          sales_reports?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          compact_view?: boolean
          created_at?: string
          dark_mode?: boolean
          email_notifications?: boolean
          id?: string
          low_stock_alerts?: boolean
          sales_reports?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      woocommerce_connections: {
        Row: {
          consumer_key: string
          consumer_secret: string
          created_at: string
          id: string
          is_active: boolean
          last_import_at: string | null
          site_name: string
          site_url: string
          total_products_imported: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consumer_key: string
          consumer_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_import_at?: string | null
          site_name: string
          site_url: string
          total_products_imported?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consumer_key?: string
          consumer_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_import_at?: string | null
          site_name?: string
          site_url?: string
          total_products_imported?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      woocommerce_import_logs: {
        Row: {
          completed_at: string | null
          connection_id: string
          created_at: string
          current_page: number | null
          error_message: string | null
          failed_products: number | null
          id: string
          imported_products: number | null
          progress_message: string | null
          started_at: string
          status: string
          total_pages: number | null
          total_products: number | null
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          created_at?: string
          current_page?: number | null
          error_message?: string | null
          failed_products?: number | null
          id?: string
          imported_products?: number | null
          progress_message?: string | null
          started_at?: string
          status: string
          total_pages?: number | null
          total_products?: number | null
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          current_page?: number | null
          error_message?: string | null
          failed_products?: number | null
          id?: string
          imported_products?: number | null
          progress_message?: string | null
          started_at?: string
          status?: string
          total_pages?: number | null
          total_products?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_import_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "woocommerce_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_sync_logs: {
        Row: {
          completed_at: string | null
          connection_id: string
          error_message: string | null
          id: string
          products_created: number | null
          products_failed: number | null
          products_updated: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          error_message?: string | null
          id?: string
          products_created?: number | null
          products_failed?: number | null
          products_updated?: number | null
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          error_message?: string | null
          id?: string
          products_created?: number | null
          products_failed?: number | null
          products_updated?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "woocommerce_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_sync_schedules: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          next_sync_at: string | null
          sync_interval_minutes: number
          sync_time: string | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          next_sync_at?: string | null
          sync_interval_minutes?: number
          sync_time?: string | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          next_sync_at?: string | null
          sync_interval_minutes?: number
          sync_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_sync_schedules_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "woocommerce_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      reusable_attributes: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          is_required: boolean
          name: string
          options: Json | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          is_required?: boolean
          name: string
          options?: Json | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          is_required?: boolean
          name?: string
          options?: Json | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reusable_attributes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_transaction: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      commit_transaction: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string }
        Returns: string
      }
      encrypt_sensitive_data: {
        Args: { data: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_woocommerce_connection_secure: {
        Args: { connection_id: string }
        Returns: {
          consumer_key: string
          consumer_secret: string
          created_at: string
          id: string
          is_active: boolean
          last_import_at: string
          site_name: string
          site_url: string
          total_products_imported: number
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_sensitive_access: {
        Args: { p_action: string; p_record_id?: string; p_table_name: string }
        Returns: undefined
      }
      rollback_transaction: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      upsert_woocommerce_connection: {
        Args: {
          p_consumer_key?: string
          p_consumer_secret?: string
          p_id?: string
          p_is_active?: boolean
          p_site_name?: string
          p_site_url?: string
          p_user_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      user_role: "admin" | "manager" | "staff" | "viewer"
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
      user_role: ["admin", "manager", "staff", "viewer"],
    },
  },
} as const
