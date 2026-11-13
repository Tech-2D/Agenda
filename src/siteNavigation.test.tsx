import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SiteNavigation } from './SiteNavigation'

it('connects all pages on the same origin and identifies the current page', () => {
  for (const active of ['agenda', 'professores', 'pegaki'] as const) {
    const html = renderToStaticMarkup(createElement(SiteNavigation, { active }))
    expect(html).toContain('href="/"')
    expect(html).toContain('href="/professores/"')
    expect(html).toContain('href="/pegaki/"')
    expect(html).not.toContain('target=')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain(`href="${active === 'agenda' ? '/' : `/${active}/`}" aria-current="page"`)
  }
})
