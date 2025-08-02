"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import type { Author, Piece } from "@/types"

interface SearchResults {
    authors: Array<Partial<Author>>
    pieces: Array<Partial<Piece> & { author_name?: string; popularity?: number }>
}

export function SearchComponent() {
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResults>({
        authors: [],
        pieces: [],
    })
    const [isSearching, setIsSearching] = useState(false)

    const handleSearch = async (query: string) => {
        setSearchQuery(query)

        if (query.length < 2) {
            setIsSearching(false)
            return
        }

        setIsSearching(true)

        const [authorsRes, piecesRes] = await Promise.all([
            supabase.from("authors").select("*").ilike("name", `%${query}%`).limit(5),
            supabase.from("pieces").select(`*`).ilike("title", `%${query}%`).limit(10),
        ])

        setSearchResults({
            authors: authorsRes.data || [],
            pieces:
                piecesRes.data?.map((p) => ({
                    id: p.id,
                    title: p.title,
                    author_name: p.authors?.name,
                    popularity: p.popularity,
                })) || [],
        })
    }

    return (
        <>
            <div className="mb-6">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#41608A] h-4 w-4" />
                    <Input
                        placeholder="Search composers or pieces..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-10 border-[#336FBD]/20 focus:border-[#336FBD] focus:ring-[#336FBD]"
                    />
                </div>
            </div>

            {isSearching && searchQuery.length >= 2 && (
                <div className="mb-8 space-y-4">
                    <h2 className="text-xl font-semibold text-[#29323E]">Search Results</h2>

                    {searchResults.authors.length > 0 && (
                        <div>
                            <h3 className="text-lg font-medium mb-2 text-[#3A4657]">Composers</h3>
                            <div className="grid gap-2">
                                {searchResults.authors.map((author) => (
                                    <Card
                                        key={author.id}
                                        className="p-3 cursor-pointer hover:shadow-md transition-all border-[#336FBD]/10 hover:border-[#336FBD]/30"
                                    >
                                        <div className="font-medium text-[#29323E]">{author.name}</div>
                                        {author.bio && <div className="text-sm text-[#3A4657] line-clamp-1">{author.bio}</div>}
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {searchResults.pieces.length > 0 && (
                        <div>
                            <h3 className="text-lg font-medium mb-2 text-[#3A4657]">Pieces</h3>
                            <div className="grid gap-2">
                                {searchResults.pieces.map((piece) => (
                                    <Link key={piece.id} href={`/piece/${piece.id}`}>
                                        <Card className="p-3 cursor-pointer hover:shadow-md transition-all border-[#336FBD]/10 hover:border-[#336FBD]/30">
                                            <div className="font-medium text-[#29323E]">{piece.title}</div>
                                            <div className="text-sm text-[#3A4657]">by {piece.author_name}</div>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
