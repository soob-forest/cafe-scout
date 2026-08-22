export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      cafe_business_snapshots: {
        Row: {
          average_stay_minutes: number | null
          cafe_visit_id: string
          close_time: string | null
          confidence_level:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          confidence_score: number | null
          created_at: string
          current_customers: number | null
          estimated_average_spend: number | null
          estimated_customers_per_hour: number | null
          estimated_daily_customers_base: number | null
          estimated_daily_customers_high: number | null
          estimated_daily_customers_low: number | null
          estimated_daily_sales_base: number | null
          estimated_daily_sales_high: number | null
          estimated_daily_sales_low: number | null
          estimated_monthly_sales_base: number | null
          estimated_monthly_sales_high: number | null
          estimated_monthly_sales_low: number | null
          estimated_seat_turns_per_hour: number | null
          estimation_model_version: string
          id: string
          observed_takeout_orders: number | null
          occupancy_input_mode:
            | Database["public"]["Enums"]["occupancy_input_mode"]
            | null
          occupancy_rate: number | null
          open_time: string | null
          operating_days_per_month: number
          operating_hours: number | null
          owner_id: string
          price_level: Database["public"]["Enums"]["price_level"] | null
          seat_count: number | null
          table_count: number | null
          takeout_adjustment_rate: number | null
          takeout_level: Database["public"]["Enums"]["takeout_level"] | null
          updated_at: string
        }
        Insert: {
          average_stay_minutes?: number | null
          cafe_visit_id: string
          close_time?: string | null
          confidence_level?:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          confidence_score?: number | null
          created_at?: string
          current_customers?: number | null
          estimated_average_spend?: number | null
          estimated_customers_per_hour?: number | null
          estimated_daily_customers_base?: number | null
          estimated_daily_customers_high?: number | null
          estimated_daily_customers_low?: number | null
          estimated_daily_sales_base?: number | null
          estimated_daily_sales_high?: number | null
          estimated_daily_sales_low?: number | null
          estimated_monthly_sales_base?: number | null
          estimated_monthly_sales_high?: number | null
          estimated_monthly_sales_low?: number | null
          estimated_seat_turns_per_hour?: number | null
          estimation_model_version?: string
          id?: string
          observed_takeout_orders?: number | null
          occupancy_input_mode?:
            | Database["public"]["Enums"]["occupancy_input_mode"]
            | null
          occupancy_rate?: number | null
          open_time?: string | null
          operating_days_per_month?: number
          operating_hours?: number | null
          owner_id: string
          price_level?: Database["public"]["Enums"]["price_level"] | null
          seat_count?: number | null
          table_count?: number | null
          takeout_adjustment_rate?: number | null
          takeout_level?: Database["public"]["Enums"]["takeout_level"] | null
          updated_at?: string
        }
        Update: {
          average_stay_minutes?: number | null
          cafe_visit_id?: string
          close_time?: string | null
          confidence_level?:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          confidence_score?: number | null
          created_at?: string
          current_customers?: number | null
          estimated_average_spend?: number | null
          estimated_customers_per_hour?: number | null
          estimated_daily_customers_base?: number | null
          estimated_daily_customers_high?: number | null
          estimated_daily_customers_low?: number | null
          estimated_daily_sales_base?: number | null
          estimated_daily_sales_high?: number | null
          estimated_daily_sales_low?: number | null
          estimated_monthly_sales_base?: number | null
          estimated_monthly_sales_high?: number | null
          estimated_monthly_sales_low?: number | null
          estimated_seat_turns_per_hour?: number | null
          estimation_model_version?: string
          id?: string
          observed_takeout_orders?: number | null
          occupancy_input_mode?:
            | Database["public"]["Enums"]["occupancy_input_mode"]
            | null
          occupancy_rate?: number | null
          open_time?: string | null
          operating_days_per_month?: number
          operating_hours?: number | null
          owner_id?: string
          price_level?: Database["public"]["Enums"]["price_level"] | null
          seat_count?: number | null
          table_count?: number | null
          takeout_adjustment_rate?: number | null
          takeout_level?: Database["public"]["Enums"]["takeout_level"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_business_snapshots_visit_owner_fk"
            columns: ["cafe_visit_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cafe_visits"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cafe_menus: {
        Row: {
          cafe_visit_id: string
          category: Database["public"]["Enums"]["menu_category"]
          created_at: string
          id: string
          is_signature: boolean
          name: string
          owner_id: string
          price: number
          sort_order: number
        }
        Insert: {
          cafe_visit_id: string
          category: Database["public"]["Enums"]["menu_category"]
          created_at?: string
          id?: string
          is_signature?: boolean
          name: string
          owner_id: string
          price: number
          sort_order: number
        }
        Update: {
          cafe_visit_id?: string
          category?: Database["public"]["Enums"]["menu_category"]
          created_at?: string
          id?: string
          is_signature?: boolean
          name?: string
          owner_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cafe_menus_visit_owner_fk"
            columns: ["cafe_visit_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cafe_visits"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cafe_photos: {
        Row: {
          bucket: string
          cafe_visit_id: string
          created_at: string
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          mime_type: string
          object_path: string
          owner_id: string
          size_bytes: number
          sort_order: number
          width: number | null
        }
        Insert: {
          bucket?: string
          cafe_visit_id: string
          created_at?: string
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["photo_kind"]
          mime_type: string
          object_path: string
          owner_id: string
          size_bytes: number
          sort_order: number
          width?: number | null
        }
        Update: {
          bucket?: string
          cafe_visit_id?: string
          created_at?: string
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["photo_kind"]
          mime_type?: string
          object_path?: string
          owner_id?: string
          size_bytes?: number
          sort_order?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_photos_visit_owner_fk"
            columns: ["cafe_visit_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cafe_visits"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cafe_visits: {
        Row: {
          adoptable_points: string | null
          cafe_id: string
          created_at: string
          customer_types: string[]
          id: string
          location_rating: number | null
          menu_rating: number | null
          mood_tags: string[]
          observation_duration_minutes: number | null
          overall_rating: number | null
          owner_id: string
          space_rating: number | null
          strengths: string | null
          updated_at: string
          visit_purposes: string[]
          visited_at: string
        }
        Insert: {
          adoptable_points?: string | null
          cafe_id: string
          created_at?: string
          customer_types?: string[]
          id?: string
          location_rating?: number | null
          menu_rating?: number | null
          mood_tags?: string[]
          observation_duration_minutes?: number | null
          overall_rating?: number | null
          owner_id: string
          space_rating?: number | null
          strengths?: string | null
          updated_at?: string
          visit_purposes?: string[]
          visited_at: string
        }
        Update: {
          adoptable_points?: string | null
          cafe_id?: string
          created_at?: string
          customer_types?: string[]
          id?: string
          location_rating?: number | null
          menu_rating?: number | null
          mood_tags?: string[]
          observation_duration_minutes?: number | null
          overall_rating?: number | null
          owner_id?: string
          space_rating?: number | null
          strengths?: string | null
          updated_at?: string
          visit_purposes?: string[]
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_visits_cafe_owner_fk"
            columns: ["cafe_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cafes: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          region: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          region: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      visit_occupancy_observations: {
        Row: {
          cafe_visit_id: string
          created_at: string
          current_customers: number | null
          id: string
          observed_at: string
          occupancy_rate: number | null
          owner_id: string
        }
        Insert: {
          cafe_visit_id: string
          created_at?: string
          current_customers?: number | null
          id?: string
          observed_at: string
          occupancy_rate?: number | null
          owner_id: string
        }
        Update: {
          cafe_visit_id?: string
          created_at?: string
          current_customers?: number | null
          id?: string
          observed_at?: string
          occupancy_rate?: number | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_observations_visit_owner_fk"
            columns: ["cafe_visit_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cafe_visits"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_operating_hours: {
        Args: { p_close: string; p_open: string }
        Returns: number
      }
      calculate_operating_minutes: {
        Args: { p_close: string; p_open: string }
        Returns: number
      }
      delete_cafe_visit: {
        Args: { p_visit_id: string }
        Returns: {
          bucket: string
          object_path: string
        }[]
      }
      finalize_cafe_photo: {
        Args: {
          p_height: number
          p_kind: Database["public"]["Enums"]["photo_kind"]
          p_mime_type: string
          p_object_path: string
          p_size_bytes: number
          p_sort_order: number
          p_visit_id: string
          p_width: number
        }
        Returns: {
          bucket: string
          cafe_visit_id: string
          created_at: string
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          mime_type: string
          object_path: string
          owner_id: string
          size_bytes: number
          sort_order: number
          width: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cafe_photos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      remove_cafe_photo: {
        Args: { p_photo_id: string; p_visit_id: string }
        Returns: {
          bucket: string
          object_path: string
        }[]
      }
      reorder_cafe_photos: {
        Args: {
          p_kind: Database["public"]["Enums"]["photo_kind"]
          p_photo_ids: string[]
          p_visit_id: string
        }
        Returns: undefined
      }
      save_cafe_visit: {
        Args: { p_payload: Json; p_visit_id?: string }
        Returns: string
      }
    }
    Enums: {
      confidence_level: "LOW" | "MEDIUM" | "HIGH"
      menu_category:
        | "COFFEE"
        | "NON_COFFEE"
        | "DESSERT"
        | "BAKERY"
        | "BRUNCH"
        | "ETC"
      occupancy_input_mode: "CUSTOMERS" | "RATE"
      photo_kind: "GENERAL" | "MENU_BOARD"
      price_level: "CHEAP" | "NORMAL" | "HIGH" | "VERY_HIGH"
      takeout_level: "NONE" | "LOW" | "MEDIUM" | "HIGH"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      confidence_level: ["LOW", "MEDIUM", "HIGH"],
      menu_category: [
        "COFFEE",
        "NON_COFFEE",
        "DESSERT",
        "BAKERY",
        "BRUNCH",
        "ETC",
      ],
      occupancy_input_mode: ["CUSTOMERS", "RATE"],
      photo_kind: ["GENERAL", "MENU_BOARD"],
      price_level: ["CHEAP", "NORMAL", "HIGH", "VERY_HIGH"],
      takeout_level: ["NONE", "LOW", "MEDIUM", "HIGH"],
    },
  },
} as const
