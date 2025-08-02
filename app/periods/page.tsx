"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"

type Period = {
  id: string
  name: string
  description: string | null
  color: string | null
  pattern: string | null
  start_year: number | null
  end_year: number | null
}

const getPeriodClassName = (periodName: string) => {
  const name = periodName.toLowerCase().replace(/\s+/g, "-").replace("&", "").replace("contemporary", "modern")
  return `period-${name}`
}

const formatYearRange = (startYear: number | null, endYear: number | null) => {
  if (!startYear && !endYear) return ""
  if (!startYear) return `Until ${endYear}`
  if (!endYear) return `${startYear} - Present`
  return `${startYear} - ${endYear}`
}

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{
    authors: Array<{
      id: string
      name: string
      bio: string | null
    }>
    pieces: Array<{
      id: string
      title: string
      author_name: string
      popularity: number | null
    }>
  }>({ authors: [], pieces: [] })
  const [isSearching, setIsSearching] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchPeriods()
  }, [])

  const fetchPeriods = async () => {
    const { data, error } = await supabase
      .from("periods")
      .select("*")
      .order("start_year", { ascending: true, nullsFirst: false })

    if (error) {
      console.error("Error fetching periods:", error)
    } else {
      setPeriods(data || [])
    }
    setLoading(false)
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    const [authorsRes, piecesRes] = await Promise.all([
      supabase.from("authors").select("id, name, bio").ilike("name", `%${query}%`).limit(5),
      supabase
        .from("pieces")
        .select(`
        id,
        title,
        popularity,
        authors!inner(name)
      `)
        .ilike("title", `%${query}%`)
        .limit(10),
    ])

    setSearchResults({
      authors: authorsRes.data || [],
      pieces:
        piecesRes.data?.map((p) => ({
          id: p.id,
          title: p.title,
          author_name: p.authors.name,
          popularity: p.popularity,
        })) || [],
    })
  }

  const handlePeriodClick = (period: Period) => {
    // Add view transition name for the clicked period
    const periodElement = document.querySelector(`[data-period-id="${period.id}"]`)
    if (periodElement) {
      periodElement.style.viewTransitionName = "period-title"
    }

    // Use view transition API if supported
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(`/periods/${period.id}`)
      })
    } else {
      router.push(`/periods/${period.id}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-lg text-[#3A4657]">Loading periods...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#29323E]" style={{ viewTransitionName: "main-title" }}>
              Musical Periods
            </h1>
          </div>
        </div>

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

        {/* Periods List */}
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
          {periods.map((period) => (
            <Card
              key={period.id}
              data-period-id={period.id}
              className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg period-card ${getPeriodClassName(period.name)} border-0`}
              onClick={() => handlePeriodClick(period)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl text-[#29323E]">{period.name}</CardTitle>
                  <div className="flex items-center gap-2 text-[#336FBD]">
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold">{formatYearRange(period.start_year, period.end_year)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-[#3A4657] leading-relaxed">
                  {period.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
