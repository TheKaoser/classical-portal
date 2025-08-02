import { ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"
import { unstable_ViewTransition as ViewTransition } from 'react'
import { motion } from "framer-motion"

export const PageHeader = ({
    viewTransitionName,
    title,
    subtitle,
    description,
    backTo
}: {
    viewTransitionName: string,
    title: string,
    subtitle?: string,
    description?: string | null,
    backTo?: string
}) => (
    <div className="flex items-center gap-4 mb-8">
        <Link href={backTo || `/`} className='flex gap-2 items-center'>
            <div className="p-2 text-[#336FBD] hover:text-[#1171F0] hover:bg-blue-50">
                <ArrowLeft />
            </div>
        </Link>
        <div>
            <ViewTransition name={viewTransitionName} >
                <h1 className="text-3xl font-bold text-[#29323E]">
                    {title}
                </h1>
            </ViewTransition>
            <div className="flex items-center gap-2 mt-2">
                <Calendar className="h-4 w-4 text-[#336FBD]" />
                <span className="text-[#336FBD] font-medium">{subtitle}</span>
            </div>
            <p className="fade-in">{description}</p>
        </div>
    </div>
)
