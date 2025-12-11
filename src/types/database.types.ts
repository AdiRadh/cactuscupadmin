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
      about_sections: {
        Row: {
          content: string
          created_at: string | null
          display_order: number | null
          gallery_urls: string[] | null
          icon: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          metadata: Json | null
          section_key: string
          section_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          display_order?: number | null
          gallery_urls?: string[] | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          metadata?: Json | null
          section_key: string
          section_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          display_order?: number | null
          gallery_urls?: string[] | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          metadata?: Json | null
          section_key?: string
          section_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          created_at: string | null
          current_participants: number
          date: string
          description: string
          duration: number
          early_bird_end_date: string | null
          early_bird_price: number | null
          early_bird_start_date: string | null
          fee: number
          gallery_images: string[] | null
          header_image_url: string | null
          id: string
          instructor: string | null
          max_participants: number | null
          requires_registration: boolean | null
          skill_level: string | null
          slug: string
          start_time: string
          status: string | null
          stripe_early_bird_price_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          type: string
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          created_at?: string | null
          current_participants?: number
          date: string
          description: string
          duration: number
          early_bird_end_date?: string | null
          early_bird_price?: number | null
          early_bird_start_date?: string | null
          fee?: number
          gallery_images?: string[] | null
          header_image_url?: string | null
          id?: string
          instructor?: string | null
          max_participants?: number | null
          requires_registration?: boolean | null
          skill_level?: string | null
          slug: string
          start_time: string
          status?: string | null
          stripe_early_bird_price_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          type: string
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          created_at?: string | null
          current_participants?: number
          date?: string
          description?: string
          duration?: number
          early_bird_end_date?: string | null
          early_bird_price?: number | null
          early_bird_start_date?: string | null
          fee?: number
          gallery_images?: string[] | null
          header_image_url?: string | null
          id?: string
          instructor?: string | null
          max_participants?: number | null
          requires_registration?: boolean | null
          skill_level?: string | null
          slug?: string
          start_time?: string
          status?: string | null
          stripe_early_bird_price_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      activity_registrations: {
        Row: {
          activity_id: string
          amount_paid: number | null
          club: string | null
          id: string
          order_id: string | null
          payment_status: string | null
          registered_at: string | null
          special_requests: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          amount_paid?: number | null
          club?: string | null
          id?: string
          order_id?: string | null
          payment_status?: string | null
          registered_at?: string | null
          special_requests?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          amount_paid?: number | null
          club?: string | null
          id?: string
          order_id?: string | null
          payment_status?: string | null
          registered_at?: string | null
          special_requests?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_registrations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          available_from: string | null
          available_until: string | null
          category: string
          created_at: string | null
          description: string | null
          featured: boolean | null
          gallery_urls: string[] | null
          has_inventory: boolean | null
          has_variants: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          max_per_order: number | null
          name: string
          price: number
          slug: string
          sort_order: number | null
          stock_quantity: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
          variants: Json | null
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          gallery_urls?: string[] | null
          has_inventory?: boolean | null
          has_variants?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_per_order?: number | null
          name: string
          price?: number
          slug: string
          sort_order?: number | null
          stock_quantity?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          variants?: Json | null
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          gallery_urls?: string[] | null
          has_inventory?: boolean | null
          has_variants?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_per_order?: number | null
          name?: string
          price?: number
          slug?: string
          sort_order?: number | null
          stock_quantity?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          variants?: Json | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          available_variables: Json | null
          created_at: string | null
          description: string | null
          html_content: string
          id: string
          subject: string
          template_key: string
          template_name: string
          text_content: string
          updated_at: string | null
        }
        Insert: {
          available_variables?: Json | null
          created_at?: string | null
          description?: string | null
          html_content: string
          id?: string
          subject: string
          template_key: string
          template_name: string
          text_content: string
          updated_at?: string | null
        }
        Update: {
          available_variables?: Json | null
          created_at?: string | null
          description?: string | null
          html_content?: string
          id?: string
          subject?: string
          template_key?: string
          template_name?: string
          text_content?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          created_at: string | null
          event_year: number
          id: string
          payment_status: string
          registered_at: string | null
          registration_fee: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_year?: number
          id?: string
          payment_status?: string
          registered_at?: string | null
          registration_fee?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_year?: number
          id?: string
          payment_status?: string
          registered_at?: string | null
          registration_fee?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      guest_instructors: {
        Row: {
          bio: string
          created_at: string | null
          display_order: number | null
          id: string
          is_featured: boolean | null
          name: string
          photo_url: string | null
          social_links: Json | null
          specialties: string[] | null
          teaching_focus: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          bio: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_featured?: boolean | null
          name: string
          photo_url?: string | null
          social_links?: Json | null
          specialties?: string[] | null
          teaching_focus?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          bio?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_featured?: boolean | null
          name?: string
          photo_url?: string | null
          social_links?: Json | null
          specialties?: string[] | null
          teaching_focus?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      hotel_partners: {
        Row: {
          address: string
          amenities: string[] | null
          background_image_url: string | null
          booking_code: string | null
          booking_url: string
          city: string
          created_at: string | null
          description: string | null
          display_order: number | null
          distance_from_airport: string | null
          distance_from_venue: string | null
          gallery_urls: string[] | null
          getting_here_text: string | null
          hotel_perks_text: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_primary: boolean | null
          name: string
          parking_info: string | null
          phone: string | null
          rate_description: string | null
          state: string
          staying_here_text: string | null
          updated_at: string | null
          zip_code: string
        }
        Insert: {
          address: string
          amenities?: string[] | null
          background_image_url?: string | null
          booking_code?: string | null
          booking_url: string
          city: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          distance_from_airport?: string | null
          distance_from_venue?: string | null
          gallery_urls?: string[] | null
          getting_here_text?: string | null
          hotel_perks_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          name: string
          parking_info?: string | null
          phone?: string | null
          rate_description?: string | null
          state: string
          staying_here_text?: string | null
          updated_at?: string | null
          zip_code: string
        }
        Update: {
          address?: string
          amenities?: string[] | null
          background_image_url?: string | null
          booking_code?: string | null
          booking_url?: string
          city?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          distance_from_airport?: string | null
          distance_from_venue?: string | null
          gallery_urls?: string[] | null
          getting_here_text?: string | null
          hotel_perks_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          name?: string
          parking_info?: string | null
          phone?: string | null
          rate_description?: string | null
          state?: string
          staying_here_text?: string | null
          updated_at?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      inventory_notifications_sent: {
        Row: {
          id: string
          resource_id: string
          resource_type: string
          sent_at: string | null
          threshold_percentage: number
        }
        Insert: {
          id?: string
          resource_id: string
          resource_type: string
          sent_at?: string | null
          threshold_percentage: number
        }
        Update: {
          id?: string
          resource_id?: string
          resource_type?: string
          sent_at?: string | null
          threshold_percentage?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          activity_registration_id: string | null
          addon_id: string | null
          created_at: string | null
          discount_amount: number | null
          discount_code: string | null
          event_registration_id: string | null
          id: string
          item_description: string | null
          item_id: string
          item_name: string
          item_sku: string | null
          item_type: string
          order_id: string
          price: number
          quantity: number | null
          special_event_registration_id: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          tournament_registration_id: string | null
          unit_price: number | null
          updated_at: string | null
          variant_data: Json | null
          variant_name: string | null
        }
        Insert: {
          activity_registration_id?: string | null
          addon_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          event_registration_id?: string | null
          id?: string
          item_description?: string | null
          item_id: string
          item_name: string
          item_sku?: string | null
          item_type: string
          order_id: string
          price?: number
          quantity?: number | null
          special_event_registration_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          tournament_registration_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          variant_data?: Json | null
          variant_name?: string | null
        }
        Update: {
          activity_registration_id?: string | null
          addon_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          event_registration_id?: string | null
          id?: string
          item_description?: string | null
          item_id?: string
          item_name?: string
          item_sku?: string | null
          item_type?: string
          order_id?: string
          price?: number
          quantity?: number | null
          special_event_registration_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          tournament_registration_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          variant_data?: Json | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_activity_registration_id_fkey"
            columns: ["activity_registration_id"]
            isOneToOne: false
            referencedRelation: "activity_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_special_event_registration_id_fkey"
            columns: ["special_event_registration_id"]
            isOneToOne: false
            referencedRelation: "special_event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tournament_registration_id_fkey"
            columns: ["tournament_registration_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          cancelled_at: string | null
          created_at: string | null
          customer_notes: string | null
          fulfillment_status: string | null
          id: string
          order_number: string | null
          order_status: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number | null
          tax: number | null
          total: number
          tracking_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          customer_notes?: string | null
          fulfillment_status?: string | null
          id?: string
          order_number?: string | null
          order_status?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          customer_notes?: string | null
          fulfillment_status?: string | null
          id?: string
          order_number?: string | null
          order_status?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organizers: {
        Row: {
          bio: string | null
          created_at: string | null
          display_order: number | null
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          role: string
          social_links: Json | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          role: string
          social_links?: Json | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          social_links?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          resource?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          club: string | null
          created_at: string | null
          experience_level: string
          first_name: string
          id: string
          last_name: string
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          club?: string | null
          created_at?: string | null
          experience_level?: string
          first_name: string
          id: string
          last_name: string
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          club?: string | null
          created_at?: string | null
          experience_level?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
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
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_type: string | null
          setting_value: string
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string | null
          setting_value: string
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string | null
          setting_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      special_event_registrations: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          dietary_restrictions: string | null
          dinner_selection: string | null
          event_id: string
          has_plus_one: boolean | null
          id: string
          is_event_registrant: boolean | null
          order_id: string | null
          payment_status: string | null
          plus_one_name: string | null
          plus_one_price_paid: number | null
          registered_at: string | null
          registration_status: string | null
          special_requests: string | null
          stripe_payment_intent_id: string | null
          ticket_price_paid: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          dietary_restrictions?: string | null
          dinner_selection?: string | null
          event_id: string
          has_plus_one?: boolean | null
          id?: string
          is_event_registrant?: boolean | null
          order_id?: string | null
          payment_status?: string | null
          plus_one_name?: string | null
          plus_one_price_paid?: number | null
          registered_at?: string | null
          registration_status?: string | null
          special_requests?: string | null
          stripe_payment_intent_id?: string | null
          ticket_price_paid?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          dietary_restrictions?: string | null
          dinner_selection?: string | null
          event_id?: string
          has_plus_one?: boolean | null
          id?: string
          is_event_registrant?: boolean | null
          order_id?: string | null
          payment_status?: string | null
          plus_one_name?: string | null
          plus_one_price_paid?: number | null
          registered_at?: string | null
          registration_status?: string | null
          special_requests?: string | null
          stripe_payment_intent_id?: string | null
          ticket_price_paid?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "special_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_event_registrations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      special_events: {
        Row: {
          allow_non_registrants: boolean | null
          allow_plus_ones: boolean | null
          allow_standalone_purchase: boolean
          content_sections: Json | null
          created_at: string | null
          created_by: string | null
          current_registrations: number | null
          description: string
          dinner_options: Json | null
          directions_text: string | null
          dress_code: string | null
          dress_code_details: string | null
          early_bird_end_date: string | null
          early_bird_start_date: string | null
          early_bird_ticket_price: number | null
          end_time: string | null
          event_date: string
          event_registrant_price: number | null
          event_type: string | null
          gallery_images: Json | null
          header_image_url: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          itinerary: Json | null
          location: string
          location_details: Json | null
          max_capacity: number | null
          nav_display_name: string
          parking_info: string | null
          plus_one_price: number | null
          register_button_text: string | null
          register_button_url: string | null
          registration_closes_at: string | null
          registration_end_date: string | null
          registration_open: boolean | null
          registration_opens_at: string | null
          registration_start_date: string | null
          slug: string
          start_time: string | null
          status: string | null
          stripe_early_bird_price_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          subtitle: string | null
          ticket_price: number | null
          title: string
          updated_at: string | null
          venue: string
          visible: boolean
        }
        Insert: {
          allow_non_registrants?: boolean | null
          allow_plus_ones?: boolean | null
          allow_standalone_purchase?: boolean
          content_sections?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_registrations?: number | null
          description: string
          dinner_options?: Json | null
          directions_text?: string | null
          dress_code?: string | null
          dress_code_details?: string | null
          early_bird_end_date?: string | null
          early_bird_start_date?: string | null
          early_bird_ticket_price?: number | null
          end_time?: string | null
          event_date: string
          event_registrant_price?: number | null
          event_type?: string | null
          gallery_images?: Json | null
          header_image_url?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          itinerary?: Json | null
          location: string
          location_details?: Json | null
          max_capacity?: number | null
          nav_display_name?: string
          parking_info?: string | null
          plus_one_price?: number | null
          register_button_text?: string | null
          register_button_url?: string | null
          registration_closes_at?: string | null
          registration_end_date?: string | null
          registration_open?: boolean | null
          registration_opens_at?: string | null
          registration_start_date?: string | null
          slug: string
          start_time?: string | null
          status?: string | null
          stripe_early_bird_price_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subtitle?: string | null
          ticket_price?: number | null
          title: string
          updated_at?: string | null
          venue: string
          visible?: boolean
        }
        Update: {
          allow_non_registrants?: boolean | null
          allow_plus_ones?: boolean | null
          allow_standalone_purchase?: boolean
          content_sections?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_registrations?: number | null
          description?: string
          dinner_options?: Json | null
          directions_text?: string | null
          dress_code?: string | null
          dress_code_details?: string | null
          early_bird_end_date?: string | null
          early_bird_start_date?: string | null
          early_bird_ticket_price?: number | null
          end_time?: string | null
          event_date?: string
          event_registrant_price?: number | null
          event_type?: string | null
          gallery_images?: Json | null
          header_image_url?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          itinerary?: Json | null
          location?: string
          location_details?: Json | null
          max_capacity?: number | null
          nav_display_name?: string
          parking_info?: string | null
          plus_one_price?: number | null
          register_button_text?: string | null
          register_button_url?: string | null
          registration_closes_at?: string | null
          registration_end_date?: string | null
          registration_open?: boolean | null
          registration_opens_at?: string | null
          registration_start_date?: string | null
          slug?: string
          start_time?: string | null
          status?: string | null
          stripe_early_bird_price_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subtitle?: string | null
          ticket_price?: number | null
          title?: string
          updated_at?: string | null
          venue?: string
          visible?: boolean
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          booth_number: string | null
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          logo_url: string | null
          name: string
          tier: string | null
          type: string
          updated_at: string | null
          visible: boolean | null
          website_url: string | null
        }
        Insert: {
          booth_number?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          logo_url?: string | null
          name: string
          tier?: string | null
          type: string
          updated_at?: string | null
          visible?: boolean | null
          website_url?: string | null
        }
        Update: {
          booth_number?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          tier?: string | null
          type?: string
          updated_at?: string | null
          visible?: boolean | null
          website_url?: string | null
        }
        Relationships: []
      }
      tournament_registrations: {
        Row: {
          amount_paid: number | null
          club: string | null
          details_completed: boolean | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          experience_level: string | null
          id: string
          medical_notes: string | null
          order_id: string | null
          payment_status: string | null
          registered_at: string | null
          stripe_payment_intent_id: string | null
          tournament_id: string
          user_id: string
          waiver_accepted: boolean
          waiver_accepted_at: string | null
          waiver_ip_address: string | null
        }
        Insert: {
          amount_paid?: number | null
          club?: string | null
          details_completed?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_level?: string | null
          id?: string
          medical_notes?: string | null
          order_id?: string | null
          payment_status?: string | null
          registered_at?: string | null
          stripe_payment_intent_id?: string | null
          tournament_id: string
          user_id: string
          waiver_accepted?: boolean
          waiver_accepted_at?: string | null
          waiver_ip_address?: string | null
        }
        Update: {
          amount_paid?: number | null
          club?: string | null
          details_completed?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_level?: string | null
          id?: string
          medical_notes?: string | null
          order_id?: string | null
          payment_status?: string | null
          registered_at?: string | null
          stripe_payment_intent_id?: string | null
          tournament_id?: string
          user_id?: string
          waiver_accepted?: boolean
          waiver_accepted_at?: string | null
          waiver_ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string | null
          current_participants: number
          date: string
          description: string | null
          display_order: number
          division: string
          early_bird_end_date: string | null
          early_bird_price: number | null
          early_bird_start_date: string | null
          end_time: string | null
          equipment_requirements: string | null
          gallery_images: string[] | null
          header_image_url: string | null
          id: string
          location: string
          max_participants: number
          name: string
          registration_end_date: string | null
          registration_fee: number
          registration_start_date: string | null
          rules: string | null
          rules_content: string | null
          rules_pdf_url: string | null
          slug: string
          start_time: string
          status: string | null
          stripe_early_bird_price_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
          visible: boolean
          weapon: string
        }
        Insert: {
          created_at?: string | null
          current_participants?: number
          date: string
          description?: string | null
          display_order?: number
          division: string
          early_bird_end_date?: string | null
          early_bird_price?: number | null
          early_bird_start_date?: string | null
          end_time?: string | null
          equipment_requirements?: string | null
          gallery_images?: string[] | null
          header_image_url?: string | null
          id?: string
          location: string
          max_participants?: number
          name: string
          registration_end_date?: string | null
          registration_fee?: number
          registration_start_date?: string | null
          rules?: string | null
          rules_content?: string | null
          rules_pdf_url?: string | null
          slug: string
          start_time: string
          status?: string | null
          stripe_early_bird_price_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          visible?: boolean
          weapon: string
        }
        Update: {
          created_at?: string | null
          current_participants?: number
          date?: string
          description?: string | null
          display_order?: number
          division?: string
          early_bird_end_date?: string | null
          early_bird_price?: number | null
          early_bird_start_date?: string | null
          end_time?: string | null
          equipment_requirements?: string | null
          gallery_images?: string[] | null
          header_image_url?: string | null
          id?: string
          location?: string
          max_participants?: number
          name?: string
          registration_end_date?: string | null
          registration_fee?: number
          registration_start_date?: string | null
          rules?: string | null
          rules_content?: string | null
          rules_pdf_url?: string | null
          slug?: string
          start_time?: string
          status?: string | null
          stripe_early_bird_price_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          visible?: boolean
          weapon?: string
        }
        Relationships: []
      }
      user_agreements: {
        Row: {
          agreed_at: string | null
          agreement_type: string
          content_version: number
          id: string
          ip_address: string | null
          tournament_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          agreed_at?: string | null
          agreement_type: string
          content_version: number
          id?: string
          ip_address?: string | null
          tournament_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          agreed_at?: string | null
          agreement_type?: string
          content_version?: number
          id?: string
          ip_address?: string | null
          tournament_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agreements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_tournament_registrations: {
        Args: { p_tournament_id: string }
        Returns: {
          club: string
          details_completed: boolean
          experience_level: string
          order_id: string
          payment_status: string
          registered_at: string
          registration_id: string
          user_email: string
          user_id: string
          user_name: string
          waiver_accepted: boolean
        }[]
      }
      admin_remove_activity_registration: {
        Args: { reason?: string; registration_id: string }
        Returns: Json
      }
      admin_remove_tournament_registration: {
        Args: { reason?: string; registration_id: string }
        Returns: Json
      }
      assign_admin_role: { Args: { user_email: string }; Returns: string }
      assign_organizer_role: { Args: { user_email: string }; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      get_activity_image_url: { Args: { bucket_path: string }; Returns: string }
      get_hotel_partner_image_url: {
        Args: { bucket_path: string }
        Returns: string
      }
      get_tournament_image_url: {
        Args: { bucket_path: string }
        Returns: string
      }
      has_permission: {
        Args: { permission_name: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: { role_name: string; user_uuid: string }
        Returns: boolean
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
