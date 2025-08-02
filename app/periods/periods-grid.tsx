import { unstable_ViewTransition as ViewTransition } from "react"
import Link from "next/link"
import type { Period } from "@/types"

interface PeriodsGridProps {
    periods: Period[]
}

export function PeriodsGrid({ periods }: PeriodsGridProps) {
    return (
        <div className="flex flex-col gap-6 mx-auto">
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
        <div>
            <Link href={`/periods/${period.id}`}>
                <ViewTransition name={`period-name-${period.id}`}>
                    <span className="inline-block font-bold text-gray-700">{period.name}</span>
                </ViewTransition>
            </Link>
        </div>
    )
}
