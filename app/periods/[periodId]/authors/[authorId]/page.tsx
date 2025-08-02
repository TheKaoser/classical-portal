"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Star } from "lucide-react"

type Author = {
  id: string
  name: string
  bio: string | null
}

type Category = {
  id: string
  name: string
  group_name: string
  pieces: Array<{
    id: string
    title: string
    popularity: number | null
  }>
}

export default function AuthorPage() {
  const params = useParams()
  const router = useRouter()
  const [author, setAuthor] = useState<Author | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.authorId) {
      fetchAuthorAndCategories(params.authorId as string)
    }
  }, [params.authorId])

  const fetchAuthorAndCategories = async (authorId: string) => {
    const [authorRes, categoriesRes] = await Promise.all([
      supabase.from("authors").select("*").eq("id", authorId).single(),
      supabase
        .from("categories")
        .select(`
          id,
          name,
          group_name,
          pieces!inner(id, title, popularity)
        `)
        .eq("pieces.author_id", authorId)
        .order("group_name"),
    ])

    if (authorRes.error) {
      console.error("Error fetching author:", authorRes.error)
    } else {
      setAuthor(authorRes.data)
    }

    if (categoriesRes.error) {
      console.error("Error fetching categories:", categoriesRes.error)
    } else {
      // Group and sort pieces by popularity
      const categoriesWithSortedPieces =
        categoriesRes.data?.map((category) => ({
          ...category,
          pieces: category.pieces.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 3), // Top 3 pieces
        })) || []

      setCategories(categoriesWithSortedPieces)
    }

    setLoading(false)
  }

  const handlePieceClick = (pieceId: string) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(`/piece/${pieceId}`)
      })
    } else {
      router.push(`/piece/${pieceId}`)
    }
  }

  const handleBack = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(`/periods/${params.periodId}`)
      })
    } else {
      router.push(`/periods/${params.periodId}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-lg text-[#3A4657]">Loading...</div>
      </div>
    )
  }

  if (!author) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-lg text-[#3A4657]">Author not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="p-2 text-[#336FBD] hover:text-[#1171F0] hover:bg-blue-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-[#29323E]" style={{ viewTransitionName: "main-title" }}>
              {author.name}
            </h1>
            {author.bio && <p className="text-[#3A4657] mt-2">{author.bio}</p>}
          </div>
        </div>

        {/* Categories and Pieces */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4 text-[#29323E]">Categories</h2>
          <ScrollArea className="h-[600px]">
            <div className="space-y-6">
              {categories.map((category) => (
                <Card key={category.id} className="border-[#336FBD]/10">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg text-[#29323E]">{category.name}</CardTitle>
                      <Badge variant="secondary" className="bg-[#336FBD]/10 text-[#336FBD] hover:bg-[#336FBD]/20">
                        {category.group_name}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {category.pieces.map((piece, index) => (
                        <div
                          key={piece.id}
                          onClick={() => handlePieceClick(piece.id)}
                          className="flex items-center gap-2 p-2 rounded hover:bg-[#336FBD]/5 cursor-pointer transition-colors"
                        >
                          {index < 3 && <Star className="h-4 w-4 text-[#1171F0] fill-current" />}
                          <span className="text-sm text-[#29323E]">{piece.title}</span>
                          {piece.popularity && (
                            <Badge variant="outline" className="ml-auto text-xs border-[#336FBD]/30 text-[#336FBD]">
                              {piece.popularity}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
