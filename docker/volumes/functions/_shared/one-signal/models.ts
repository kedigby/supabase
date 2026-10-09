/**
 * Models for the OneSignal Messages API (subset).
 * Generated from the OpenAPI 3.0.3 definition — https://api.onesignal.com
 */
import Onesignal from 'npm:@onesignal/node-onesignal';

export const onesignalApiKey = Deno.env.get('ONESIGNAL_API_KEY')
export const onesignalAppId = Deno.env.get('ONESIGNAL_API_APP_ID')
const configuration = Onesignal.createConfiguration({ restApiKey: onesignalApiKey });
export const oneSignalApiClient = new Onesignal.DefaultApi(configuration);


export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Message delivery medium. Also used as the `c` query parameter on `POST /notifications`. */
export type TargetChannel = 'push' | 'email' | 'sms'

/**
 * Multi-language mapping dictionary, keyed by 2-character language codes.
 */
export interface StringMap {
  /** Default English text message content. */
  en?: string
  [languageCode: string]: string | undefined
}

/** Fields shared by every channel: targeting, scheduling and bookkeeping. */
export interface NotificationRequestBase {
  /** The primary message delivery medium. OneSignal defaults to `push`. */
  target_channel?: TargetChannel
  /** Internal name shown in the OneSignal dashboard. Max 128 characters. Required for SMS. */
  name?: string

  // Targeting: use one method per request
  /** Audience mapping by user alias, e.g. `{ external_id: ['user-1'] }`. */
  include_aliases?: Record<string, string[]>
  /** Target specific subscription UUIDs directly (max 20,000). */
  include_subscription_ids?: string[]
  /** Target audience segments (e.g. `["Total Subscriptions", "Active Users"]`). */
  included_segments?: string[]
  /** Audience segments to actively exclude. */
  excluded_segments?: string[]

  // Scheduling
  /** When OneSignal should deliver, e.g. `"2026-10-25 14:00:00 GMT-0500"`. The only scheduling option SMS supports. */
  send_after?: string

  // Bookkeeping
  /** Dashboard template ID. Can supply the content in place of the channel-specific fields. */
  template_id?: string
  /** Data made available to templates (all channels). */
  custom_data?: Record<string, unknown>
  /** Client-generated UUID that prevents duplicate notifications on API retries. */
  idempotency_key?: string
}

export interface PushNotificationRequest extends NotificationRequestBase {
  /** Optional: OneSignal defaults to push. */
  target_channel?: 'push'
  contents: StringMap
  headings?: StringMap
  subtitle?: StringMap
  /** Custom key-value payload delivered to your app (push only). */
  data?: Record<string, unknown>
  /** URL opened on click, all platforms. */
  url?: string
  /** Android image URL. */
  big_picture?: string
  /** Seconds. Default 3 days, max 28 days. */
  ttl?: number
  /** 10 = high priority. */
  priority?: number
  /** Replaces an earlier notification with the same ID. Max 64 characters. */
  collapse_id?: string
  ios_sound?: string
  thread_id?: string
  android_channel_id?: string
}

export interface EmailNotificationRequest extends NotificationRequestBase {
  target_channel: 'email'
  email_subject: string
  /** HTML body. Required unless `template_id` is set. Must include an `[unsubscribe_url]` link. */
  email_body?: string
  email_preheader?: string
  email_from_name?: string
  email_from_address?: string
  email_reply_to_address?: string
  /** Send to email addresses directly. */
  email_to?: string[]
}

export interface SmsNotificationRequest extends NotificationRequestBase {
  target_channel: 'sms'
  /** Required by OneSignal for SMS. */
  name?: string
  contents: StringMap
  /** Registered sender number, E.164 format. */
  sms_from?: string
  /** MMS media: up to 10 URLs, 5MB total. */
  sms_media_urls?: string[]
  /** E.164 numbers that already have subscriptions. */
  include_phone_numbers?: string[]
}

/** Request body for `POST /notifications`, discriminated on `target_channel`. */
export type NotificationRequest =
  | PushNotificationRequest
  | EmailNotificationRequest
  | SmsNotificationRequest

/**
 * Response body for `POST /notifications` (200).
 * A 200 response may still contain `errors` if no valid subscribers were matched.
 */
export interface NotificationResponse {
  /** OneSignal notification ID. Empty string if unsent. */
  id?: string
  /** External ID, if provided in the request. */
  external_id?: string
  /** Estimated number of channel instances targeted. */
  recipients?: number
  /** Rejection warnings or operational failures. */
  errors?: string[]
}