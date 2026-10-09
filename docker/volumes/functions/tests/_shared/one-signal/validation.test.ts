import { assertEquals, assertExists } from 'jsr:@std/assert'
import { describe, it } from 'jsr:@std/testing/bdd'

import { json, validateNotificationRequest } from '../../../_shared/one-signal/validation.ts'
import { NotificationRequest } from '../../../_shared/one-signal/models.ts'

describe('validateNotificationRequest', () => {
  it('valid email', () => {
    const body : NotificationRequest = {
      "name": "keith",
      "include_aliases" : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      "target_channel" : "email",
      "email_subject": "Via Supabase Edge 'Function",
      "email_body": "<h1>Hello!</h1><p>This is an HTML email, sent via Supabase.</p>"
    };
    const response = validateNotificationRequest(body)
    assertEquals(true, response.valid)
  })
  it('email missing email_body', () => {
    const body : NotificationRequest = {
      "name": "keith",
      "include_aliases" : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      "target_channel" : "email",
      "email_subject": "Via Supabase Edge 'Function",
    };
    const response = validateNotificationRequest(body)

    assertEquals(false, response.valid)
    assertEquals("is required unless template_id is provided", response.props.email_body)
  })
  it('email missing email_subject', () => {
    const body : any = {
      "name": "keith",
      "include_aliases" : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      "target_channel" : "email",
      "email_body": "<h1>Hello!</h1><p>This is an HTML email, sent via Supabase.</p>"
    };
    const response = validateNotificationRequest(body)

    assertEquals(false, response.valid)
    assertEquals("is required unless template_id is provided", response.props.email_subject)
  })
  it('valid sms', () => {
    const body : NotificationRequest = {
      contents : { en: 'Your SMS message content here' },
      include_aliases : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      sms_from: '+15551234567',
      target_channel : "sms"
    };
    const response = validateNotificationRequest(body)
    console.log('valid sms response', response)
    assertEquals(true, response.valid)
  })
  it('sms missing contents and template_id', () => {
    const body : any = {
      include_aliases : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      sms_from: '+15551234567',
      target_channel : "sms"
    };
    const response = validateNotificationRequest(body)
    console.log('sms push response', response)
    assertEquals(false, response.valid)
    assertEquals("is required unless template_id is provided", response.props.contents)
  })
  it('valid push', () => {
    const body : NotificationRequest = {
      contents : { en: 'Your Push message content here' },
      headings : { en: 'Your Push message headings here' },
      include_aliases : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      target_channel : "push"
    };
    const response = validateNotificationRequest(body)
    console.log('valid push response', response)
    assertEquals(true, response.valid)
  })
  it('push missing contents and template_id', () => {
    const body : any = {
      headings : { en: 'Your Push message headings here' },
      include_aliases : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      target_channel : "push"
    };
    const response = validateNotificationRequest(body)
    console.log('valid push response', response)
    assertEquals(false, response.valid)
    assertEquals("is required unless template_id is provided", response.props.contents)
  })
  it('push missing headings and template_id', () => {
    const body : any = {
      contents : { en: 'Your Push message content here' },
      include_aliases : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      target_channel : "push"
    };
    const response = validateNotificationRequest(body)
    console.log('valid push response', response)
    assertEquals(false, response.valid)
    assertEquals("is required unless template_id is provided", response.props.headings)
  })
  it('non object', () => {
    const response = validateNotificationRequest(null)
    assertEquals(false, response.valid)
    assertEquals('must be a JSON object', response.props.body)
  })
  it('mixed include targets', () => {
    const body : NotificationRequest = {
      contents : { en: 'Your SMS message content here' },
      include_aliases : { "supabase_id": ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"] },
      included_segments : ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"],
      include_phone_numbers : ["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"],
      include_subscription_ids :["0e79714b-0e44-43c8-90a7-6a9eb71cb1b2"],
      sms_from: '+15551234567',
      target_channel : "sms"
    };
    const response = validateNotificationRequest(body)
    console.log('valid push response', response)
    assertEquals(false, response.valid)
    assertEquals('only one of include_aliases, include_subscription_ids, included_segments may be provided, got include_aliases, include_subscription_ids, included_segments', response.props.targeting)
  })
  it('no include targets', () => {
    const body : NotificationRequest = {
      contents : { en: 'Your SMS message content here' },
      sms_from: '+15551234567',
      target_channel : "sms"
    };
    const response = validateNotificationRequest(body)
    assertEquals(false, response.valid)
    assertEquals('one of include_aliases, include_subscription_ids, included_segments is required', response.props.targeting)
  })
  it('json happy path', () => {
    const body : NotificationRequest = {
      contents : { en: 'Your SMS message content here' },
      sms_from: '+15551234567',
      target_channel : "sms"
    };
    const response = json(body)
    assertExists<Response>(response)
  })
  it('invalid field type', () => {
    const body: any = {
      contents: { en: 'Your Push message content here' },
      headings: { en: 'Your Push message headings here' },
      include_aliases: { supabase_id: ['0e79714b-0e44-43c8-90a7-6a9eb71cb1b2'] },
      target_channel: 'push',
      ttl: 'soon', // must be a number
    }
    const response = validateNotificationRequest(body)
    assertEquals(false, response.valid)
    assertEquals('must be a number', response.props.ttl)
  })
})