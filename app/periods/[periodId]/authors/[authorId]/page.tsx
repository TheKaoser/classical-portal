import { unstable_ViewTransition as ViewTransition } from "react"
import { PageHeader } from "@/components/custom/page-header"
import { getCachedPeriod } from "@/services/periods.service"
import { CategoriesGrid } from "./components/categories-grid"
import { getCachedAuthor } from "@/services/authors.service"
import { getCachedCategories } from "@/services/categories.service"

export default async function AuthorPage({ params }: { params: { authorId: string; periodId: string } }) {
  const { authorId, periodId } = params
  const [author, categories, period] = await Promise.all([
    getCachedAuthor(authorId),
    getCachedCategories(authorId),
    getCachedPeriod(periodId)
  ])

  if (!period) return null;

  return (
    <ViewTransition>
      <PageHeader
        title={author.name}
        viewTransitionName={`author-name-${author.id}`}
        subtitle={period.name || "Unknown Period"}
        description={author.bio ? author.bio : "No biography available"}
        backTo={`/periods/${periodId}`}
      />
      <CategoriesGrid categories={categories} />
    </ViewTransition>
  )
}
