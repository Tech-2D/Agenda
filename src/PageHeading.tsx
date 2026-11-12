import type { LucideIcon } from 'lucide-react'

type PageHeadingProps = {
  icon: LucideIcon
  title: string
  description?: string
}

export function PageHeading({ icon: Icon, title, description }: PageHeadingProps) {
  return (
    <header className="interface-heading">
      <span className="interface-heading-icon" aria-hidden="true"><Icon size={22} /></span>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </header>
  )
}
