import { describe, expect, it } from 'vitest'

import { getPostHogSecrets, isPostHogInstalled, POSTHOG_SECRET_NAMES } from './PostHog.utils'

const allSecrets = Object.values(POSTHOG_SECRET_NAMES).map((name) => ({ name }))

describe('isPostHogInstalled', () => {
  it('returns true when every PostHog secret exists', () => {
    expect(isPostHogInstalled([...allSecrets, { name: 'unrelated' }])).toBe(true)
  })

  it('returns false when a PostHog secret is missing', () => {
    expect(isPostHogInstalled(allSecrets.slice(1))).toBe(false)
  })

  it('returns false when there are no secrets', () => {
    expect(isPostHogInstalled([])).toBe(false)
  })
})

describe('getPostHogSecrets', () => {
  it('returns only PostHog secrets', () => {
    expect(getPostHogSecrets([...allSecrets, { name: 'unrelated' }])).toEqual(allSecrets)
  })

  it('returns a partial set when some PostHog secrets are missing', () => {
    expect(getPostHogSecrets(allSecrets.slice(0, 1))).toEqual(allSecrets.slice(0, 1))
  })
})
