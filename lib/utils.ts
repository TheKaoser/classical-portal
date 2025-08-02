import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const formatYearRange = (startYear: number, endYear?: number | null) => {
  if (startYear === endYear) {
    return startYear.toString()
  }
  return `${startYear} - ${endYear || "Present"}`
}