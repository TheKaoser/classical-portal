"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink } from "lucide-react"

type PieceDetail = {
  id: string
  title: string
  video_url: string | null
  popularity: number | null
  author: {
    name: string
    bio: string | null
  }
  category: {
    name: string
    group_name: string
  }
}

export default function PieceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [piece, setPiece] = useState<PieceDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchPiece(params.id as string)
    }
  }, [params.id])

  const fetchPiece = async (pieceId: string) => {
    const { data, error } = await supabase
      .from("pieces")
      .select(`
        id,
        title,
        video_url,
        popularity,
        authors!inner(name, bio),
        categories!inner(name, group_name)
      `)
      .eq("id", pieceId)
      .single()

    if (error) {
      console.error("Error fetching piece:", error)
    } else if (data) {
      setPiece({
        ...data,
        author: data.authors,
        category: data.categories,
      })
    }
    setLoading(false)
  }

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return videoId ? `https://www.youtube.com/embed/${videoId[1]}` : null
  }

  const handleClose = () => {
    router.back()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#29323E] flex items-center justify-center">
        <div className="text-white text-lg">Loading piece...</div>
      </div>
    )
  }

  if (!piece) {
    return (
      <div className="min-h-screen bg-[#29323E] flex items-center justify-center">
        <div className="text-white text-lg">Piece not found</div>
      </div>
    )
  }

  const embedUrl = piece.video_url ? getYouTubeEmbedUrl(piece.video_url) : null

  return (
    <div className="min-h-screen bg-[#29323E] text-white relative">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClose}
        className="absolute top-4 left-4 z-10 text-white hover:bg-[#3A4657] hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Video Player */}
      <div className="w-full h-screen flex items-center justify-center">
        {embedUrl ? (
          <div className="w-full max-w-6xl aspect-video">
            <iframe
              src={embedUrl}
              title={piece.title}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">{piece.title}</h1>
            <p className="text-xl text-gray-300">by {piece.author.name}</p>
            <p className="text-gray-400">No video available for this piece</p>
            {piece.video_url && (
              <Button
                variant="outline"
                asChild
                className="border-[#336FBD] text-[#336FBD] hover:bg-[#336FBD] hover:text-white bg-transparent"
              >
                <a href={piece.video_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Original Link
                </a>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Piece Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#29323E] via-[#29323E]/90 to-transparent p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">{piece.title}</h1>
          <p className="text-xl text-gray-300 mb-2">by {piece.author.name}</p>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="bg-[#336FBD]/20 text-[#336FBD] px-2 py-1 rounded">
              {piece.category.group_name} • {piece.category.name}
            </span>
            {piece.popularity && (
              <span className="bg-[#1171F0]/20 text-[#1171F0] px-2 py-1 rounded">
                Popularity: {piece.popularity}/100
              </span>
            )}
          </div>
          {piece.author.bio && <p className="text-gray-300 mt-4 max-w-2xl">{piece.author.bio}</p>}
        </div>
      </div>
    </div>
  )
}
