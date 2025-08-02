import { unstable_ViewTransition as ViewTransition } from 'react'
import Link from 'next/link';
import { formatYearRange } from '@/lib/utils';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/custom/page-header';
import { getCachedPeriod } from '@/services/periods.service';
import { getCachedAuthors } from '@/services/authors.service';

export default async function PeriodPage({ params }: { params: { periodId: string } }) {
  const { periodId } = params;
  const period = await getCachedPeriod(periodId);
  const authors = await getCachedAuthors(periodId);

  if (!period) return null;
  if (!authors) return null;

  return (
    <div>
      <PageHeader
        title={period.name}
        viewTransitionName={`period-name-${period.id}`}
        subtitle={period.start_year && period.end_year ? formatYearRange(period.start_year, period.end_year) : undefined}
        description={period.description}
        backTo='/periods'
      />
      <div className='space-y-6'>
        <div className="space-y-4">
          {authors!.map((author) => (
            <Link href={`/periods/${periodId}/authors/${author.id}`} key={author.id}>
              <Card
                key={author.id}
                data-author-id={author.id}
                className="cursor-pointer hover:shadow-md transition-all duration-200 border-[#336FBD]/10 hover:border-[#336FBD]/30"
              >
                <CardHeader>
                  <ViewTransition name={`author-name-${author.id}`}>
                    <CardTitle className="text-lg text-[#29323E]">{author.name}</CardTitle>
                  </ViewTransition>
                  {author.bio && (
                    <CardDescription className="text-sm line-clamp-2 text-[#3A4657]">{author.bio}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
