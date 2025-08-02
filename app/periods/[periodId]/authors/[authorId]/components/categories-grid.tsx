"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"
import type { Category, Piece } from "@/types"

interface CategoriesGridProps {
    categories: (Category & { pieces: Piece[] })[]
}

export function CategoriesGrid({ categories }: CategoriesGridProps) {
    const router = useRouter()

    const handlePieceClick = (pieceId: string) => {
        if (document.startViewTransition) {
            document.startViewTransition(() => {
                router.push(`/piece/${pieceId}`)
            })
        } else {
            router.push(`/piece/${pieceId}`)
        }
    }

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4 text-[#29323E]">Categories</h2>

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
        </div>
    )
}
