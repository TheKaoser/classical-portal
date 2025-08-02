"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Calendar } from "lucide-react"

type Period = {
  id: string
  name: string
  description: string | null
  start_year: number | null
  end_year: number | null
}

type Author = {
  id: string
  name: string
  bio: string | null
}

const formatYearRange = (startYear: number | null, endYear: number | null) => {
  if (!startYear && !endYear) return ""
  if (!startYear) return `Until ${endYear}`
  if (!endYear) return `${startYear} - Present`
  return `${startYear} - ${endYear}`
}

export default function PeriodPage() {
  const params = useParams()
  const router = useRouter()
  const [period, setPeriod] = useState<Period | null>(null)
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.periodId) {
      fetchPeriodAndAuthors(params.periodId as string)
    }
  }, [params.periodId])

  const fetchPeriodAndAuthors = async (periodId: string) => {
    const [periodRes, authorsRes] = await Promise.all([
      supabase.from("periods").select("*").eq("id", periodId).single(),
      supabase.from("authors").select("*").eq("period_id", periodId).order("name").limit(10),
    ])

    if (periodRes.error) {
      console.error("Error fetching period:", periodRes.error)
    } else {
      setPeriod(periodRes.data)
    }

    if (authorsRes.error) {
      console.error("Error fetching authors:", authorsRes.error)
    } else {
      setAuthors(authorsRes.data || [])
    }

    setLoading(false)
  }

  const handleAuthorClick = (author: Author) => {
    // Add view transition name for the clicked author
    const authorElement = document.querySelector(`[data-author-id="${author.id}"]`)
    if (authorElement) {
      authorElement.style.viewTransitionName = "author-title"
    }

    // Use view transition API if supported
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(`/periods/${params.periodId}/authors/${author.id}`)
      })
    } else {
      router.push(`/periods/${params.periodId}/authors/${author.id}`)
    }
  }

  const handleBack = () => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push("/periods")
      })
    } else {
      router.push("/periods")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-lg text-[#3A4657]">Loading...</div>
      </div>
    )
  }

  if (!period) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-lg text-[#3A4657]">Period not found</div>
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
              {period.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="h-4 w-4 text-[#336FBD]" />
              <span className="text-[#336FBD] font-medium">{formatYearRange(period.start_year, period.end_year)}</span>
            </div>
            {period.description && <p className="text-[#3A4657] mt-2">{period.description}</p>}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Left Column - Period Info */}
          <div className="w-1/3">
            <Card className="border-[#336FBD]/10">
              <CardHeader>
                <CardTitle className="text-[#29323E]">{period.name}</CardTitle>
                <div className="flex items-center gap-2 text-[#336FBD]">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold">{formatYearRange(period.start_year, period.end_year)}</span>
                </div>
                <CardDescription className="text-[#3A4657]">{period.description}</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Right Column - Authors */}
          <div className="w-2/3">
            <h2 className="text-2xl font-semibold mb-4 text-[#29323E]">Composers</h2>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {authors.map((author) => (
                  <Card
                    key={author.id}
                    data-author-id={author.id}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 border-[#336FBD]/10 hover:border-[#336FBD]/30"
                    onClick={() => handleAuthorClick(author)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg text-[#29323E]">{author.name}</CardTitle>
                      {author.bio && (
                        <CardDescription className="text-sm line-clamp-2 text-[#3A4657]">{author.bio}</CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
