import { View } from 'lucide-react'
import Link from 'next/link'
import { unstable_ViewTransition as ViewTransition } from 'react'

export default function Page() {
  return (
    <ViewTransition>
      <ViewTransition name="experimental-label">
        <span className='inline-block font-bold text-gray-700'>{`<ViewTransitions>`}</span>
      </ViewTransition>
      <h2 className="text-xl underline">
        <Link href="/blog">{`Floating Elements Transition`}</Link>
      </h2>
    </ViewTransition>
  )
}
