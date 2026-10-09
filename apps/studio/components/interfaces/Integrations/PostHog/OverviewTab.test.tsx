import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { platformComponents as components } from 'api-types'
import { mockAnimationsApi } from 'jsdom-testing-mocks'
import { HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { PostHogOverviewTab } from './OverviewTab'
import { POSTHOG_SECRET_NAMES } from './PostHog.utils'
import type { ProjectDetail } from '@/data/projects/project-detail-query'
import { customRender } from '@/tests/lib/custom-render'
import { addAPIMock } from '@/tests/lib/msw'
import type { VaultSecret } from '@/types'

type RunQueryBody = components['schemas']['RunQueryBody']

// The shared shell looks the integration up by route and fires extension queries; only the
// slots this tab fills matter here.
vi.mock('../Integration/IntegrationOverviewTab', () => ({
  IntegrationOverviewTab: ({
    actions,
    status,
    children,
  }: {
    actions?: ReactNode
    status?: ReactNode
    children: ReactNode
  }) => (
    <div>
      {status}
      {actions}
      {children}
    </div>
  ),
}))

mockAnimationsApi()

const PROJECT: ProjectDetail = {
  cloud_provider: 'AWS',
  connectionString: 'postgresql://postgres@localhost:5432/postgres',
  db_host: 'db.default.supabase.co',
  high_availability: false,
  id: 1,
  inserted_at: '2026-01-01T00:00:00.000Z',
  integration_source: null,
  is_branch_enabled: false,
  is_hibernating: false,
  is_physical_backups_enabled: false,
  name: 'Test project',
  organization_id: 1,
  ref: 'default',
  region: 'us-east-1',
  restUrl: 'https://default.supabase.co/rest/v1',
  status: 'ACTIVE_HEALTHY',
  subscription_id: 'subscription-1',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const createSecret = (name: string, id: string): VaultSecret => ({
  id,
  key_id: null,
  name,
  description: 'PostHog integration',
  secret: 'encrypted',
  created_at: '2026-01-01 00:00:00+00',
  updated_at: '2026-01-01 00:00:00+00',
})

const ALL_POSTHOG_SECRETS = Object.values(POSTHOG_SECRET_NAMES).map((name, i) =>
  createSecret(name, `00000000-0000-0000-0000-00000000000${i}`)
)

/**
 * Backs every Vault query with an in-memory list, so the list query reflects the writes the
 * form makes. Returns the write statements it saw, in order.
 */
const mockVault = (initialSecrets: VaultSecret[]) => {
  let secrets = [...initialSecrets]
  const writes: Array<'create' | 'update' | 'delete'> = []

  addAPIMock({
    method: 'post',
    path: '/platform/pg-meta/:ref/query',
    response: async ({ request }) => {
      const { query } = (await request.json()) as RunQueryBody

      if (query.includes('vault.create_secret')) {
        writes.push('create')
        const name = Object.values(POSTHOG_SECRET_NAMES).find((n) => query.includes(`'${n}'`))
        const id = `11111111-1111-1111-1111-11111111111${secrets.length}`
        if (name) secrets.push(createSecret(name, id))
        return HttpResponse.json([{ create_secret: id }])
      }
      if (query.includes('vault.update_secret')) {
        writes.push('update')
        return HttpResponse.json([{ update_secret: '' }])
      }
      if (/delete\s+from/i.test(query)) {
        writes.push('delete')
        secrets = secrets.filter((secret) => !query.includes(secret.id))
        return HttpResponse.json([])
      }
      // vault.secrets list query
      return HttpResponse.json<VaultSecret[]>(secrets)
    },
  })

  return { writes }
}

const fillForm = async () => {
  const apiHost = await screen.findByLabelText('API host')
  await userEvent.clear(apiHost)
  await userEvent.type(apiHost, 'https://eu.i.posthog.com')
  await userEvent.type(screen.getByLabelText('Project ID'), '12345')
  await userEvent.type(screen.getByLabelText('Project token'), 'phc_test_token')
}

describe('PostHogOverviewTab', () => {
  beforeEach(() => {
    addAPIMock({ method: 'get', path: '/platform/projects/:ref', response: PROJECT })
  })

  test('shows validation errors and saves nothing for invalid values', async () => {
    const { writes } = mockVault([])
    customRender(<PostHogOverviewTab />)

    const apiHost = await screen.findByLabelText('API host')
    await userEvent.clear(apiHost)
    await userEvent.type(apiHost, 'not a url')
    await userEvent.type(screen.getByLabelText('Project ID'), 'abc')
    await userEvent.type(screen.getByLabelText('Project token'), 'wrong_prefix')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/Must be a valid URL/)).toBeInTheDocument()
    expect(screen.getByText('Project ID must be a number')).toBeInTheDocument()
    expect(screen.getByText('Project token starts with "phc_"')).toBeInTheDocument()
    expect(writes).toEqual([])
  })

  test('creates the three secrets and then shows PostHog as configured', async () => {
    const { writes } = mockVault([])
    customRender(<PostHogOverviewTab />)

    expect(screen.queryByText('Configured')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Uninstall' })).not.toBeInTheDocument()

    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Configured')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uninstall' })).toBeInTheDocument()
    expect(writes).toEqual(['create', 'create', 'create'])
    // The form clears after saving because the stored values are write-only.
    expect(screen.getByLabelText('Project token')).toHaveValue('')
  })

  test('updates the existing secrets instead of creating duplicates', async () => {
    const { writes } = mockVault(ALL_POSTHOG_SECRETS)
    customRender(<PostHogOverviewTab />)

    expect(await screen.findByText('Configured')).toBeInTheDocument()

    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(writes).toEqual(['update', 'update', 'update']))
  })

  test('uninstall deletes every PostHog secret after confirmation', async () => {
    const { writes } = mockVault([...ALL_POSTHOG_SECRETS, createSecret('unrelated', 'other-id')])
    customRender(<PostHogOverviewTab />)

    await userEvent.click(await screen.findByRole('button', { name: 'Uninstall' }))
    const dialog = await screen.findByRole('dialog')
    expect(writes).toEqual([])

    await userEvent.click(within(dialog).getByRole('button', { name: 'Uninstall' }))

    await waitFor(() => expect(screen.queryByText('Configured')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Uninstall' })).not.toBeInTheDocument()
    expect(writes).toEqual(['delete', 'delete', 'delete'])
  })

  test('uninstall removes a partial install', async () => {
    const { writes } = mockVault(ALL_POSTHOG_SECRETS.slice(0, 1))
    customRender(<PostHogOverviewTab />)

    // Not configured, but there is still something to clean up.
    await userEvent.click(await screen.findByRole('button', { name: 'Uninstall' }))
    expect(screen.queryByText('Configured')).not.toBeInTheDocument()
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Uninstall' })
    )

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Uninstall' })).not.toBeInTheDocument()
    )
    expect(writes).toEqual(['delete'])
  })
})
