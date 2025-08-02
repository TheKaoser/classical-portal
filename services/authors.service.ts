import { Author } from "@/types";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

export const getCachedAuthors = unstable_cache(
  async (periodId: string): Promise<Author[]> => {
    const { data, error } = await supabase
      .from("authors")
      .select("*")
      .eq("period_id", periodId)
      .order("name")
      .limit(10);

    if (error) throw error;
    return data ?? [];
  },
  ['authors-by-period']
);

export const getCachedAuthor = unstable_cache(
  async (authorId: string) => {
    const { data, error } = await supabase
      .from("authors")
      .select("*")
      .eq("id", authorId)
      .single();

    if (error) {
      console.error("Error fetching author:", error);
      return null;
    }

    return data;
  },
  ["author-by-id"],
  {
    revalidate: 3600,
    tags: ["authors"],
  }
);
