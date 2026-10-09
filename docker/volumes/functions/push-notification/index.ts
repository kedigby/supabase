import { withSupabase, type SupabaseContext } from 'npm:@supabase/server@^1'
import Onesignal from 'npm:@onesignal/node-onesignal';
import { oneSignalApiClient, onesignalApiKey, onesignalAppId, corsHeaders, NotificationRequest, TargetChannel } from '../_shared/one-signal/models.ts'
import { json, validateNotificationRequest } from '../_shared/one-signal/validation.ts'
import { randomUUID } from 'node:crypto';


export default {
  fetch: withSupabase({ auth: 'user' }, async (req : Request, ctx : SupabaseContext) => {

    if (req.method !== 'POST')
    {
      return json({ error: `Method ${req.method} not allowed` }, 405)
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }

    const validation = validateNotificationRequest(body)
    if (!validation.valid) {
      return json({ error: 'Invalid notification request', props: validation.props }, 400)
    }
    const notificationRequest = validation.value

    // Field names match the SDK's Notification, so the validated body can be copied across.
    const notification = Object.assign(new Onesignal.Notification(), notificationRequest, { app_id: onesignalAppId })
    notification.idempotency_key = notificationRequest.idempotency_key || randomUUID();

    let response : any;
    try {
      response = await oneSignalApiClient.createNotification(notification)
      if (!response.id) {
        console.warn("Notification was not sent:", response.errors);
      } else if (response.errors) {
        console.log("Notification created:", response.id, "(partial failures:", response.errors, ")");
      } else {
        console.log("Notification created:", response.id);
      }
    } catch (e) {
      if (e instanceof Onesignal.ApiException) {
        const apiException :  Onesignal.ApiException = e
        console.error("createNotification failed: HTTP " + apiException.code, apiException.errorMessages);
      } else {
        throw e;
      }

      return json({ error: 'unknown exception occurred' }, 500)
    }

    return Response.json({ message: `Notification created`, meta: response}, {status: 201})
  }),


}