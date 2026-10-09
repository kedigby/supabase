import { corsHeaders, NotificationRequest, TargetChannel } from './models.ts'

const isObject = (v: unknown): v is Record<string, unknown> =>  typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStringArray = (v: unknown): v is string[] =>  Array.isArray(v) && v.every(isString)
const isStringMap = (v: unknown) =>  isObject(v) && Object.values(v).every(isString)

type ValidationErrors = Record<string, string>
type ValidationResult<T> = { valid: boolean; value?: T ;props: ValidationErrors }

/** How to check one field. Missing fields only fail when `required` is set. */
type Rule = { check: (v: unknown) => boolean; message: string; required?: boolean }

const STRING: Rule = { check: isString, message: 'must be a string' }
const NUMBER: Rule = { check: isNumber, message: 'must be a number' }
const OBJECT: Rule = { check: isObject, message: 'must be an object' }
const STRING_ARRAY: Rule = { check: isStringArray, message: 'must be an array of strings' }
const STRING_MAP: Rule = {
  check: isStringMap,
  message: 'must be an object of language code to string, e.g. { "en": "Hello" }',
}
const requiredRule = (rule: Rule): Rule => ({ ...rule, required: true })

/** Runs each rule against `b` and records a message per failing field. */
function checkFields(b: Record<string, unknown>, rules: Record<string, Rule>, errors: ValidationErrors) {
  for (const [field, rule] of Object.entries(rules)) {
    const value = b[field]
    if (value === undefined) {
      if (rule.required) errors[field] = 'is required'
    } else if (!rule.check(value)) {
      errors[field] = rule.message
    }
  }
}

const TARGET_CHANNELS: TargetChannel[] = ['push', 'email', 'sms']
const TARGETING_FIELDS = ['include_aliases', 'include_subscription_ids', 'included_segments']

const BASE_RULES: Record<string, Rule> = {
  target_channel: {
    check: (v) => TARGET_CHANNELS.includes(v as TargetChannel),
    message: `must be one of ${TARGET_CHANNELS.join(', ')}`,
  },
  name: { check: (v) => isString(v) && v.length <= 128, message: 'must be a string of at most 128 characters' },
  include_aliases: {
    check: (v) => isObject(v) && Object.values(v).every(isStringArray),
    message: 'must be an object of alias label to string array, e.g. { "external_id": ["user-1"] }',
  },
  include_subscription_ids: {
    check: (v) => isStringArray(v) && v.length <= 20_000,
    message: 'must be an array of at most 20,000 strings',
  },
  included_segments: STRING_ARRAY,
  excluded_segments: STRING_ARRAY,
  send_after: STRING,
  template_id: STRING,
  custom_data: OBJECT,
  idempotency_key: STRING,
}

const PUSH_RULES: Record<string, Rule> = {
  contents: requiredRule(STRING_MAP),
  headings: STRING_MAP,
  subtitle: STRING_MAP,
  data: OBJECT,
  url: STRING,
  big_picture: STRING,
  ttl: NUMBER,
  priority: NUMBER,
  collapse_id: { check: (v) => isString(v) && v.length <= 64, message: 'must be a string of at most 64 characters' },
  ios_sound: STRING,
  thread_id: STRING,
  android_channel_id: STRING,
}

const EMAIL_RULES: Record<string, Rule> = {
  email_subject: requiredRule(STRING),
  email_body: STRING,
  email_preheader: STRING,
  email_from_name: STRING,
  email_from_address: STRING,
  email_reply_to_address: STRING,
  email_to: STRING_ARRAY,
}

const SMS_RULES: Record<string, Rule> = {
  name: STRING,
  contents: requiredRule(STRING_MAP),
  sms_from: requiredRule(STRING),
  sms_media_urls: {
    check: (v) => isStringArray(v) && v.length <= 10,
    message: 'must be an array of at most 10 strings',
  },
  include_phone_numbers: STRING_ARRAY,
}

/** Checks the fields on NotificationRequestBase, shared by every channel. */
function validateNotificationRequestBase(b: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {}
  checkFields(b, BASE_RULES, errors)

  // OneSignal rejects requests that mix targeting methods, so exactly one is allowed.
  const targets = TARGETING_FIELDS.filter((field) => b[field] !== undefined)
  if (targets.length === 0) {
    errors.targeting = `one of ${TARGETING_FIELDS.join(', ')} is required`
  } else if (targets.length > 1) {
    errors.targeting = `only one of ${TARGETING_FIELDS.join(', ')} may be provided, got ${targets.join(', ')}`
  }

  return errors
}

export function validateNotificationRequest(body: unknown): ValidationResult<NotificationRequest> {
  if (!isObject(body)) {
    return { valid: false, props: { body: 'must be a JSON object' } }
  }

  const errors = validateNotificationRequestBase(body)

  switch (body.target_channel ?? 'push') {
    case 'push':
      checkFields(body, PUSH_RULES, errors)
      if (body.contents  === undefined && body.template_id === undefined) {
        errors.contents  = 'is required unless template_id is provided'
      }
      if (body.headings  === undefined && body.template_id === undefined) {
        errors.headings  = 'is required unless template_id is provided'
      }
      break
    case 'email':
      checkFields(body, EMAIL_RULES, errors)
      if (body.email_body === undefined && body.template_id === undefined) {
        errors.email_body = 'is required unless template_id is provided'
      }
      if (body.email_subject  === undefined && body.template_id === undefined) {
        errors.email_subject  = 'is required unless template_id is provided'
      }
      break
    case 'sms':
      checkFields(body, SMS_RULES, errors)
      if (body.contents   === undefined && body.template_id === undefined) {
        errors.contents   = 'is required unless template_id is provided'
      }
      break
    // An unknown target_channel is already reported by BASE_RULES.
  }

  return Object.keys(errors).length === 0
    ? { valid: true, value: body as unknown as NotificationRequest, props: {} }
    : { valid: false, props: errors }
}

export const json = (body: unknown, status = 200, allow: string = 'POST, OPTIONS' ) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      Allow: allow,
    },
  })