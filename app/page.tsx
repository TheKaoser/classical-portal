import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
      <div className="text-center space-y-8 px-4">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-[#29323E] via-[#336FBD] to-[#1171F0] bg-clip-text text-transparent">
            Structured Classical Music
          </h1>
          <p className="text-xl md:text-2xl text-[#3A4657] max-w-2xl mx-auto">Search your next masterpiece</p>
        </div>

        <div className="pt-8">
          <Link href="/periods">
            <Button
              size="lg"
              className="text-lg px-8 py-6 bg-[#336FBD] hover:bg-[#1171F0] transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Explore the periods
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
