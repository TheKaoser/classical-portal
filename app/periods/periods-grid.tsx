import { unstable_ViewTransition as ViewTransition } from "react"
import Link from "next/link"
import type { Period } from "@/types"
import { cn, formatYearRange } from "@/lib/utils"
import "@/styles/patterns.css"
import { Badge } from "@/components/ui/badge"

interface PeriodsGridProps {
    periods: Period[]
}

export function PeriodsGrid({ periods }: PeriodsGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mx-auto">
            {periods.map((period) => (
                <PeriodCard key={period.id} period={period} />
            ))}
        </div>
    )
}

interface PeriodCardProps {
    period: Period
}

function PeriodCard({ period }: PeriodCardProps) {
    return (
        <Link href={`/periods/${period.id}`}>
            <div
                className={cn(
                    "p-8 aspect-square shadow-md gap-3 rounded-xl cursor-pointer hover:translate-y-1 transition-transform flex flex-col relative overflow-hidden"
                )}
                style={{
                    backgroundImage: 'url(/images/baroque.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                {/* Overlay for brightness */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: 'url(/images/baroque.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'brightness(0.5)',
                        zIndex: 1,
                    }}
                />
                <div className="relative z-10">
                    <ViewTransition name={`period-name-${period.id}`}>
                        <span className="inline-block font-bold text-white text-2xl">{period.name}</span>
                    </ViewTransition>
                    <p className="text-sm text-gray-100 line-clamp-2">
                        {period.start_year ? `${formatYearRange(period.start_year, period.end_year)}` : "Unknown Period"}
                    </p>
                </div>
            </div>
        </Link>
    )
}
