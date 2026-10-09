'use server';

export interface SendSmsParams {
  recipient: string;
  message: string;
  senderId?: string;
  scheduleTime?: string;
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
  const apiToken = process.env.TEXT_LK_API_TOKEN;
  const defaultSenderId = process.env.TEXT_LK_SENDER_ID;

  if (!apiToken || !(senderId || defaultSenderId)) {
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
    const payload: Record<string, any> = {
      api_token: apiToken,
      recipient: formattedRecipient,
      sender_id: senderId || defaultSenderId,
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

    const data = await res.json();

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
  } catch (error: any) {
    console.error('[sms] Text.lk could not be reached');
    return {
      success: false,
      error: error.message || 'Failed to dispatch SMS request',
    };
  }
}
