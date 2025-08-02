import type { Database } from './database.types'

// Generic type helpers
type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]

// Tables
export type Author = Tables<"authors">
export type AuthorInsert = TablesInsert<"authors">
export type AuthorUpdate = TablesUpdate<"authors">

export type Category = Tables<"categories">
export type CategoryInsert = TablesInsert<"categories">
export type CategoryUpdate = TablesUpdate<"categories">

export type Period = Tables<"periods">
export type PeriodInsert = TablesInsert<"periods">
export type PeriodUpdate = TablesUpdate<"periods">

export type Piece = Tables<"pieces">
export type PieceInsert = TablesInsert<"pieces">
export type PieceUpdate = TablesUpdate<"pieces">
