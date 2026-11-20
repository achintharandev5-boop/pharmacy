'use server';
import { uiTestEnabled, UI_TEST_NOT_SAVED } from '@/lib/uiTestMode';

import { getCurrentUser } from './auth';

export interface SendSmsParams {
  recipient: string;
  message: string;
  senderId?: string;
  scheduleTime?: string;
}

interface TextLkRequest {
  api_token: string;
  recipient: string;
  sender_id: string;
  type: 'plain';
  message: string;
  schedule_time?: string;
}

interface TextLkResponse {
  status?: string;
  message?: string;
  data?: unknown;
}

/**
 * Normalizes Sri Lankan phone numbers to the 94XXXXXXXXX format expected by Text.lk.
 * Handles formats like:
 * - '0771234567' -> '94771234567'
 * - '+94771234567' -> '94771234567'
 * - '771234567' -> '94771234567'
 */
export async function formatSriLankanPhoneNumber(phone: string): Promise<string> {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '94' + clean.substring(1);
  } else if (!clean.startsWith('94') && clean.length === 9) {
    clean = '94' + clean;
  }
  return clean;
}

/**
 * Sends an SMS message to a client using the Text.lk REST API gateway.
 */
export async function sendClientSms({
  recipient,
  message,
  senderId,
  scheduleTime,
}: SendSmsParams) {
  if (uiTestEnabled()) return { success: false, error: UI_TEST_NOT_SAVED };
  // Pilot containment: recipient consent, authorization and durable rate limiting are
  // not yet verified. Preserve the provider implementation but prevent pilot sends.
  // Production stays disabled even if an operator accidentally enables the legacy flag.
  if (process.env.NODE_ENV === 'production' || process.env.SMS_ENABLED !== 'true') {
    return { success: false, error: 'SMS is disabled for this deployment.' };
  }
  // Server actions are public POST endpoints, and the middleware only checks that a session
  // cookie exists. Verify the session with the API before using the pharmacy's SMS account.
  const session = await getCurrentUser();
  if (!session.ok) {
    return {
      success: false,
      error: session.status === 401 ? 'Your session has expired. Sign in again to send SMS.' : session.error,
    };
  }
  if (session.data.role !== 'admin' && session.data.role !== 'pharmacist') {
    return { success: false, error: 'You do not have permission to send SMS.' };
  }

  const apiToken = process.env.TEXT_LK_API_TOKEN;
  const defaultSenderId = process.env.TEXT_LK_SENDER_ID;
  const activeSenderId = senderId || defaultSenderId;

  if (!apiToken || !activeSenderId) {
    console.error('[sms] TEXT_LK_API_TOKEN or TEXT_LK_SENDER_ID is not configured');
    return {
      success: false,
      error: 'SMS is not configured on this server (TEXT_LK_API_TOKEN and TEXT_LK_SENDER_ID are required).',
    };
  }

  const formattedRecipient = await formatSriLankanPhoneNumber(recipient);

  if (!formattedRecipient || formattedRecipient.length < 11) {
    return {
      success: false,
      error: `Invalid recipient phone number (${recipient}). Must be a valid Sri Lankan mobile number.`,
    };
  }

  try {
    const payload: TextLkRequest = {
      api_token: apiToken,
      recipient: formattedRecipient,
      sender_id: activeSenderId,
      type: 'plain',
      message: message,
    };

    if (scheduleTime) {
      payload.schedule_time = scheduleTime;
    }

    const res = await fetch('https://app.text.lk/api/http/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as TextLkResponse;

    if (!res.ok || data.status === 'error') {
      // Status only: the gateway response can echo the recipient number.
      console.error(`[sms] Text.lk rejected the message (HTTP ${res.status})`);
      return {
        success: false,
        error: data.message || `Failed to send SMS (Status: ${res.status})`,
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (error: unknown) {
    console.error('[sms] Text.lk could not be reached');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dispatch SMS request',
    };
  }
}
