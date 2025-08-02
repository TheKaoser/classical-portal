import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      periods: {
        Row: {
          id: string
          name: string
          description: string | null
          color: string | null
          pattern: string | null
          start_year: number | null
          end_year: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          color?: string | null
          pattern?: string | null
          start_year?: number | null
          end_year?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          color?: string | null
          pattern?: string | null
          start_year?: number | null
          end_year?: number | null
          created_at?: string
        }
      }
      authors: {
        Row: {
          id: string
          name: string
          period_id: string | null
          bio: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          period_id?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          period_id?: string | null
          bio?: string | null
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          group_name: "Orchestral" | "Chamber" | "Solo" | "Opera" | "Vocal" | "Ballet"
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          group_name: "Orchestral" | "Chamber" | "Solo" | "Opera" | "Vocal" | "Ballet"
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          group_name?: "Orchestral" | "Chamber" | "Solo" | "Opera" | "Vocal" | "Ballet"
          created_at?: string
        }
      }
      pieces: {
        Row: {
          id: string
          title: string
          author_id: string | null
          category_id: string | null
          video_url: string | null
          popularity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          author_id?: string | null
          category_id?: string | null
          video_url?: string | null
          popularity?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          author_id?: string | null
          category_id?: string | null
          video_url?: string | null
          popularity?: number | null
          created_at?: string
        }
      }
    }
  }
}
