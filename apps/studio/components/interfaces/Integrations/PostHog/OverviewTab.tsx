import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  Form,
  FormControl,
  FormField,
  Input,
} from 'ui'
import { ConfirmationModal } from 'ui-patterns/Dialogs/ConfirmationModal'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import * as z from 'zod'

import { IntegrationOverviewTab } from '../Integration/IntegrationOverviewTab'
import { getPostHogSecrets, isPostHogInstalled, POSTHOG_SECRET_NAMES } from './PostHog.utils'
import { useVaultSecretCreateMutation } from '@/data/vault/vault-secret-create-mutation'
import { useVaultSecretDeleteMutation } from '@/data/vault/vault-secret-delete-mutation'
import { useVaultSecretUpdateMutation } from '@/data/vault/vault-secret-update-mutation'
import { useVaultSecretsQuery } from '@/data/vault/vault-secrets-query'
import { useSelectedProjectQuery } from '@/hooks/misc/useSelectedProject'

const FORM_ID = 'posthog-settings-form'

const FormSchema = z.object({
  apiHost: z.string().trim().url('Must be a valid URL, e.g. https://us.i.posthog.com'),
  projectId: z.string().trim().regex(/^\d+$/, 'Project ID must be a number'),
  projectToken: z.string().trim().startsWith('phc_', 'Project token starts with "phc_"'),
})
type FormValues = z.infer<typeof FormSchema>

const defaultValues: FormValues = {
  apiHost: 'https://us.i.posthog.com',
  projectId: '',
  projectToken: '',
}

export const PostHogOverviewTab = () => {
  const { data: project } = useSelectedProjectQuery()

  const { data: secrets } = useVaultSecretsQuery({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
  })
  const { mutateAsync: createSecret } = useVaultSecretCreateMutation()
  const { mutateAsync: updateSecret } = useVaultSecretUpdateMutation()
  const { mutateAsync: deleteSecret } = useVaultSecretDeleteMutation()

  const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState(false)

  const isConfigured = isPostHogInstalled(secrets ?? [])
  const postHogSecrets = getPostHogSecrets(secrets ?? [])
  const canUninstall = postHogSecrets.length > 0

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  })
  const { isDirty, isSubmitting } = form.formState

  /** Updates the secret if one with this name exists, otherwise creates it. */
  const upsertSecret = async (name: string, value: string) => {
    if (!project) return
    const existing = secrets?.find((secret) => secret.name === name)
    const target = { projectRef: project.ref, connectionString: project.connectionString }

    if (existing) {
      await updateSecret({ ...target, id: existing.id, secret: value })
    } else {
      await createSecret({ ...target, name, secret: value, description: 'PostHog integration' })
    }
  }

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      // Sequential so a failure stops before later secrets are written.
      await upsertSecret(POSTHOG_SECRET_NAMES.apiHost, values.apiHost)
      await upsertSecret(POSTHOG_SECRET_NAMES.projectId, values.projectId)
      await upsertSecret(POSTHOG_SECRET_NAMES.projectToken, values.projectToken)
      toast.success('PostHog settings saved to Vault')
      // Secrets are write-only here, so clear the form rather than re-baselining to the saved values.
      form.reset(defaultValues)
    } catch {
      // The Vault mutations already show an error toast.
    }
  }

  const handleUninstall = async () => {
    if (!project) return
    setIsUninstalling(true)
    try {
      for (const secret of postHogSecrets) {
        await deleteSecret({
          projectRef: project.ref,
          connectionString: project.connectionString,
          id: secret.id,
        })
      }
      toast.success('PostHog uninstalled')
      setIsUninstallModalOpen(false)
    } catch {
      // The Vault mutation already shows an error toast.
    } finally {
      setIsUninstalling(false)
    }
  }

  return (
    <IntegrationOverviewTab
      status={isConfigured ? <Badge variant="success">Configured</Badge> : undefined}
      actions={
        canUninstall && (
          <Button variant="danger" onClick={() => setIsUninstallModalOpen(true)}>
            Uninstall
          </Button>
        )
      }
    >
      <div className="px-4 md:px-10 max-w-4xl space-y-4">
        <Form {...form}>
          <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiHost"
                  render={({ field }) => (
                    <FormItemLayout
                      layout="horizontal"
                      label="API host"
                      description="Your PostHog ingestion host, e.g. https://us.i.posthog.com or https://eu.i.posthog.com"
                    >
                      <FormControl>
                        <Input {...field} placeholder="https://us.i.posthog.com" />
                      </FormControl>
                    </FormItemLayout>
                  )}
                />
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItemLayout
                      layout="horizontal"
                      label="Project ID"
                      description="Found in PostHog under Project settings"
                    >
                      <FormControl>
                        <Input {...field} inputMode="numeric" placeholder="12345" />
                      </FormControl>
                    </FormItemLayout>
                  )}
                />
                <FormField
                  control={form.control}
                  name="projectToken"
                  render={({ field }) => (
                    <FormItemLayout
                      layout="horizontal"
                      label="Project token"
                      description={
                        isConfigured
                          ? 'Already saved. Submitting replaces all three values.'
                          : 'Starts with phc_'
                      }
                    >
                      <FormControl>
                        <Input {...field} type="password" autoComplete="off" placeholder="phc_…" />
                      </FormControl>
                    </FormItemLayout>
                  )}
                />
              </CardContent>
              <CardFooter className="justify-end space-x-2">
                {isDirty && (
                  <Button variant="default" disabled={isSubmitting} onClick={() => form.reset()}>
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  form={FORM_ID}
                  disabled={!isDirty || !project}
                  loading={isSubmitting}
                >
                  Save
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      </div>
      <ConfirmationModal
        visible={isUninstallModalOpen}
        variant="destructive"
        title="Uninstall PostHog"
        description="This deletes the PostHog API host, project ID and project token from Vault. Anything that reads these secrets will stop working."
        confirmLabel="Uninstall"
        confirmLabelLoading="Uninstalling"
        loading={isUninstalling}
        onCancel={() => setIsUninstallModalOpen(false)}
        onConfirm={handleUninstall}
      />
    </IntegrationOverviewTab>
  )
}
