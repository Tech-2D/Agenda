import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SiteNavigation } from './SiteNavigation'

it('connects all pages on the same origin and identifies the current page', () => {
  for (const active of ['agenda', 'professores', 'pegaki', 'kanban'] as const) {
    const html = renderToStaticMarkup(createElement(SiteNavigation, { active }))
    expect(html).toContain('href="/"')
    expect(html).toContain('href="/professores/"')
    expect(html).toContain('href="/pegaki/"')
    expect(html).toContain('>Notaki</a>')
    expect(html).toContain('href="/#kanban"')
    expect(html).toContain('aria-label="Abrir menu" aria-haspopup="dialog" aria-expanded="false"')
    expect(html).not.toContain('target=')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain(`href="${active === 'agenda' ? '/' : active === 'kanban' ? '/#kanban' : `/${active}/`}" aria-current="page"`)
  }
})

it('shows the direct management link for the current Agenda role', () => {
  const navigation = (role?: 'representante' | 'superadmin', active: 'agenda' | 'professores' | 'pegaki' | 'admin' = 'pegaki') =>
    renderToStaticMarkup(createElement(SiteNavigation, { active, role }))

  expect(navigation()).not.toContain('href="/admin/"')
  expect(navigation('representante')).toMatch(/href="\/admin\/"[^]*?>Representante<\/a>/)
  expect(navigation('superadmin')).toMatch(/href="\/admin\/"[^]*?>Administração<\/a>/)
  expect(navigation('superadmin', 'admin')).toContain('href="/admin/" aria-current="page"')
  expect(navigation('superadmin', 'admin')).toContain('aria-label="Abrir menu"')
})
