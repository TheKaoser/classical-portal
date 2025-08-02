import { Period } from "@/types";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

export const getCachedPeriods = unstable_cache(
    async () => {
        const { data, error } = await supabase
            .from("periods")
            .select("*")
            .order("start_year", { ascending: true, nullsFirst: false });

        if (error) {
            console.error("Error fetching periods:", error);
            return [];
        }

        return data || [];
    },
    ["periods-list"],
    {
        revalidate: 3600,
        tags: ["periods"],
    }
);

export const getCachedPeriod = unstable_cache(
    async (id: string): Promise<Period | null> =>
        supabase
            .from("periods")
            .select("*")
            .eq("id", id)
            .single()
            .then((res: { data: Period | null }) => res.data),
    ['period-by-id']
);
