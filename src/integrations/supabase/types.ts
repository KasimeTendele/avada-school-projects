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
      admin_schools: {
        Row: {
          created_at: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string | null
          created_at: string
          id: string
          level: string | null
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          academic_year: string | null
          amount: number
          class_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          fee_type: string
          id: string
          label: string
          school_id: string
          scope: Database["public"]["Enums"]["fee_scope"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          amount: number
          class_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          fee_type: string
          id?: string
          label: string
          school_id: string
          scope: Database["public"]["Enums"]["fee_scope"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          amount?: number
          class_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          fee_type?: string
          id?: string
          label?: string
          school_id?: string
          scope?: Database["public"]["Enums"]["fee_scope"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          events: boolean
          payments: boolean
          push_enabled: boolean
          reminders: boolean
          system: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          events?: boolean
          payments?: boolean
          push_enabled?: boolean
          reminders?: boolean
          system?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          events?: boolean
          payments?: boolean
          push_enabled?: boolean
          reminders?: boolean
          system?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          read: boolean
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          school_id: string
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          school_id: string
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "options_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_user_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_user_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_user_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          fee_id: string
          id: string
          initiated_by: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          reference: string | null
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          fee_id: string
          id?: string
          initiated_by?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          reference?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          fee_id?: string
          id?: string
          initiated_by?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          reference?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          employee_matricule: string | null
          first_name: string | null
          full_name: string | null
          function_title: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          physical_address: string | null
          post_name: string | null
          primary_school_id: string | null
          profession: string | null
          professional_address: string | null
          relationship: string | null
          status: Database["public"]["Enums"]["user_status"]
          substitute: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          employee_matricule?: string | null
          first_name?: string | null
          full_name?: string | null
          function_title?: string | null
          gender?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          physical_address?: string | null
          post_name?: string | null
          primary_school_id?: string | null
          profession?: string | null
          professional_address?: string | null
          relationship?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          substitute?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          employee_matricule?: string | null
          first_name?: string | null
          full_name?: string | null
          function_title?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          physical_address?: string | null
          post_name?: string | null
          primary_school_id?: string | null
          profession?: string | null
          professional_address?: string | null
          relationship?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          substitute?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          pdf_url: string | null
          receipt_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          pdf_url?: string | null
          receipt_number: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          pdf_url?: string | null
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          approval_number: string | null
          city: string | null
          created_at: string
          director_email: string | null
          director_first_name: string | null
          director_last_name: string | null
          director_phone: string | null
          director_photo_url: string | null
          director_post_name: string | null
          email: string | null
          epst_number: string | null
          id: string
          levels: string[]
          logo_url: string | null
          management_type: string | null
          matricule: string | null
          name: string
          phone: string | null
          promoter_name: string | null
          promoter_phone: string | null
          regime: string | null
          sections: string[]
          sigle: string | null
          status: Database["public"]["Enums"]["school_status"]
          updated_at: string
          vacation: string | null
        }
        Insert: {
          address?: string | null
          approval_number?: string | null
          city?: string | null
          created_at?: string
          director_email?: string | null
          director_first_name?: string | null
          director_last_name?: string | null
          director_phone?: string | null
          director_photo_url?: string | null
          director_post_name?: string | null
          email?: string | null
          epst_number?: string | null
          id?: string
          levels?: string[]
          logo_url?: string | null
          management_type?: string | null
          matricule?: string | null
          name: string
          phone?: string | null
          promoter_name?: string | null
          promoter_phone?: string | null
          regime?: string | null
          sections?: string[]
          sigle?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          updated_at?: string
          vacation?: string | null
        }
        Update: {
          address?: string | null
          approval_number?: string | null
          city?: string | null
          created_at?: string
          director_email?: string | null
          director_first_name?: string | null
          director_last_name?: string | null
          director_phone?: string | null
          director_photo_url?: string | null
          director_post_name?: string | null
          email?: string | null
          epst_number?: string | null
          id?: string
          levels?: string[]
          logo_url?: string | null
          management_type?: string | null
          matricule?: string | null
          name?: string
          phone?: string | null
          promoter_name?: string | null
          promoter_phone?: string | null
          regime?: string | null
          sections?: string[]
          sigle?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          updated_at?: string
          vacation?: string | null
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          birth_date: string | null
          birth_place: string | null
          class_id: string | null
          created_at: string
          enrollment_date: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          matricule: string | null
          option_id: string | null
          photo_url: string | null
          physical_address: string | null
          post_name: string | null
          school_id: string
          section_id: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          birth_place?: string | null
          class_id?: string | null
          created_at?: string
          enrollment_date?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          matricule?: string | null
          option_id?: string | null
          photo_url?: string | null
          physical_address?: string | null
          post_name?: string | null
          school_id: string
          section_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          birth_place?: string | null
          class_id?: string | null
          created_at?: string
          enrollment_date?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          matricule?: string | null
          option_id?: string | null
          photo_url?: string | null
          physical_address?: string | null
          post_name?: string | null
          school_id?: string
          section_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          last_login_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_login_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_login_at?: string | null
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_has_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      find_student_by_matricule: {
        Args: { _matricule: string; _school_id: string }
        Returns: {
          academic_year: string
          already_linked: boolean
          class_level: string
          class_name: string
          first_name: string
          id: string
          last_name: string
          matricule: string
          school_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      link_self_to_student: {
        Args: { _relationship?: string; _student_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "cashier" | "parent"
      fee_scope: "STUDENT" | "CLASS" | "SCHOOL"
      notification_type: "PAYMENT" | "REMINDER" | "EVENT" | "SYSTEM" | "FEE"
      payment_method: "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "CARD"
      payment_status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED"
      school_status: "active" | "suspended" | "pending"
      user_status: "active" | "suspended" | "pending"
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
      app_role: ["super_admin", "admin", "cashier", "parent"],
      fee_scope: ["STUDENT", "CLASS", "SCHOOL"],
      notification_type: ["PAYMENT", "REMINDER", "EVENT", "SYSTEM", "FEE"],
      payment_method: ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CARD"],
      payment_status: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"],
      school_status: ["active", "suspended", "pending"],
      user_status: ["active", "suspended", "pending"],
    },
  },
} as const
