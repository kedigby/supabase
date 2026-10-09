import type { VaultSecret } from '@/types'

/** Vault secret names the PostHog settings are stored under. */
export const POSTHOG_SECRET_NAMES = {
  apiHost: 'PostHog_Api_Host',
  projectId: 'PostHog_Project_Id',
  projectToken: 'PostHog_Project_Token',
} as const

const SECRET_NAME_SET = new Set<string>(Object.values(POSTHOG_SECRET_NAMES))

/** The Vault secrets that belong to PostHog, including a partial set left by a failed save. */
export const getPostHogSecrets = <T extends Pick<VaultSecret, 'name'>>(secrets: T[]) =>
  secrets.filter((secret) => SECRET_NAME_SET.has(secret.name))

/** PostHog counts as installed once every one of its settings has been saved to Vault. */
export const isPostHogInstalled = (secrets: Pick<VaultSecret, 'name'>[]) =>
  Object.values(POSTHOG_SECRET_NAMES).every((name) =>
    secrets.some((secret) => secret.name === name)
  )
