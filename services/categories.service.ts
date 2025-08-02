import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

export const getCachedCategories = unstable_cache(
  async (authorId: string) => {
    const { data, error } = await supabase
      .from("categories")
      .select(`
        id,
        name,
        group_name,
        created_at,
        pieces!inner(id, title, popularity, created_at, author_id, category_id, video_url)
      `)
      .eq("pieces.author_id", authorId)
      .order("group_name");

    if (error) {
      console.error("Error fetching categories:", error);
      return [];
    }

    const categoriesWithSortedPieces =
      data?.map((category) => ({
        id: category.id,
        name: category.name,
        group_name: category.group_name,
        created_at: category.created_at ?? null,
        pieces: (category.pieces ?? [])
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 3)
          .map((piece) => ({
            id: piece.id,
            title: piece.title,
            popularity: piece.popularity ?? null,
            created_at: piece.created_at ?? null,
            author_id: piece.author_id ?? null,
            category_id: piece.category_id ?? null,
            video_url: piece.video_url ?? null,
          })),
      })) || [];

    return categoriesWithSortedPieces;
  },
  ["categories-by-author"],
  {
    revalidate: 3600,
    tags: ["categories", "pieces"],
  }
);
``
