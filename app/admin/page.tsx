"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

type Period = {
  id: string
  name: string
}

type Author = {
  id: string
  name: string
  period_id: string
}

type Category = {
  id: string
  name: string
  group_name: string
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<Period[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const { toast } = useToast()

  // Form states
  const [authorForm, setAuthorForm] = useState({
    name: "",
    period_id: "",
    bio: "",
  })

  const [pieceForm, setPieceForm] = useState({
    title: "",
    author_id: "",
    category_id: "",
    video_url: "",
    popularity: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [periodsRes, authorsRes, categoriesRes] = await Promise.all([
      supabase.from("periods").select("id, name").order("name"),
      supabase.from("authors").select("id, name, period_id").order("name"),
      supabase.from("categories").select("id, name, group_name").order("group_name, name"),
    ])

    if (periodsRes.data) setPeriods(periodsRes.data)
    if (authorsRes.data) setAuthors(authorsRes.data)
    if (categoriesRes.data) setCategories(categoriesRes.data)
    setLoading(false)
  }

  const handleAddAuthor = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from("authors").insert([authorForm])

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add author",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Author added successfully",
      })
      setAuthorForm({ name: "", period_id: "", bio: "" })
      fetchData()
    }
  }

  const handleAddPiece = async (e: React.FormEvent) => {
    e.preventDefault()
    const pieceData = {
      ...pieceForm,
      popularity: pieceForm.popularity ? Number.parseInt(pieceForm.popularity) : null,
    }

    const { error } = await supabase.from("pieces").insert([pieceData])

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add piece",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Piece added successfully",
      })
      setPieceForm({ title: "", author_id: "", category_id: "", video_url: "", popularity: "" })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        <Tabs defaultValue="authors" className="space-y-6">
          <TabsList>
            <TabsTrigger value="authors">Add Author</TabsTrigger>
            <TabsTrigger value="pieces">Add Piece</TabsTrigger>
          </TabsList>

          <TabsContent value="authors">
            <Card>
              <CardHeader>
                <CardTitle>Add New Author</CardTitle>
                <CardDescription>Add a new composer to the database</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddAuthor} className="space-y-4">
                  <div>
                    <Label htmlFor="author-name">Name</Label>
                    <Input
                      id="author-name"
                      value={authorForm.name}
                      onChange={(e) => setAuthorForm({ ...authorForm, name: e.target.value })}
                      placeholder="e.g., Ludwig van Beethoven"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="author-period">Period</Label>
                    <Select
                      value={authorForm.period_id}
                      onValueChange={(value) => setAuthorForm({ ...authorForm, period_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a period" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((period) => (
                          <SelectItem key={period.id} value={period.id}>
                            {period.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="author-bio">Biography</Label>
                    <Textarea
                      id="author-bio"
                      value={authorForm.bio}
                      onChange={(e) => setAuthorForm({ ...authorForm, bio: e.target.value })}
                      placeholder="Brief biography of the composer..."
                      rows={3}
                    />
                  </div>

                  <Button type="submit">Add Author</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pieces">
            <Card>
              <CardHeader>
                <CardTitle>Add New Piece</CardTitle>
                <CardDescription>Add a new musical piece to the database</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddPiece} className="space-y-4">
                  <div>
                    <Label htmlFor="piece-title">Title</Label>
                    <Input
                      id="piece-title"
                      value={pieceForm.title}
                      onChange={(e) => setPieceForm({ ...pieceForm, title: e.target.value })}
                      placeholder="e.g., Symphony No. 9 in D minor"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="piece-author">Author</Label>
                    <Select
                      value={pieceForm.author_id}
                      onValueChange={(value) => setPieceForm({ ...pieceForm, author_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an author" />
                      </SelectTrigger>
                      <SelectContent>
                        {authors.map((author) => (
                          <SelectItem key={author.id} value={author.id}>
                            {author.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="piece-category">Category</Label>
                    <Select
                      value={pieceForm.category_id}
                      onValueChange={(value) => setPieceForm({ ...pieceForm, category_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.group_name} - {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="piece-video">Video URL</Label>
                    <Input
                      id="piece-video"
                      type="url"
                      value={pieceForm.video_url}
                      onChange={(e) => setPieceForm({ ...pieceForm, video_url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="piece-popularity">Popularity (0-100)</Label>
                    <Input
                      id="piece-popularity"
                      type="number"
                      min="0"
                      max="100"
                      value={pieceForm.popularity}
                      onChange={(e) => setPieceForm({ ...pieceForm, popularity: e.target.value })}
                      placeholder="85"
                    />
                  </div>

                  <Button type="submit">Add Piece</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
