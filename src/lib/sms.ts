import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { smsLog } from '../db/schema';
import { env } from '../config/env';

interface SendSmsOptions {
  phoneNumber: string;
  message: string;
  clientId?: string;
  sentById?: string;
  context?: string;
  contextId?: string;
}

function formatPhone(phone: string): string {
  let clean = phone.replace(/[\s\-\.]/g, '');
  if (clean.startsWith('0')) {
    clean = '+33' + clean.slice(1);
  }
  if (!clean.startsWith('+')) {
    clean = '+33' + clean;
  }
  return clean;
}

export async function sendSms(opts: SendSmsOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const phone = formatPhone(opts.phoneNumber);

  const [logEntry] = await db.insert(smsLog).values({
    phoneNumber: phone,
    message: opts.message,
    status: 'pending',
    clientId: opts.clientId || null,
    sentById: opts.sentById || null,
    context: opts.context || null,
    contextId: opts.contextId || null,
  }).returning();

  if (env.SMS_ENABLED !== 'true') {
    console.log(`[SMS DISABLED] To: ${phone} | ${opts.message}`);
    await db.update(smsLog).set({ status: 'sent', apiResponse: { simulated: true } }).where(eq(smsLog.id, logEntry!.id));
    return { success: true, id: logEntry!.id };
  }

  try {
    const credentials = Buffer.from(`${env.SMS_API_USER}:${env.SMS_API_PASSWORD}`).toString('base64');

    const response = await fetch(env.SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        phoneNumbers: [phone],
        message: opts.message,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      await db.update(smsLog).set({ status: 'sent', apiResponse: data }).where(eq(smsLog.id, logEntry!.id));
      console.log(`[SMS SENT] To: ${phone} | ${opts.message.substring(0, 50)}...`);
      return { success: true, id: logEntry!.id };
    } else {
      const errMsg = data.message || `HTTP ${response.status}`;
      await db.update(smsLog).set({ status: 'failed', apiResponse: data, errorMessage: errMsg }).where(eq(smsLog.id, logEntry!.id));
      console.error(`[SMS FAILED] To: ${phone} | ${errMsg}`);
      return { success: false, error: errMsg };
    }
  } catch (error: any) {
    await db.update(smsLog).set({ status: 'failed', errorMessage: error.message }).where(eq(smsLog.id, logEntry!.id));
    console.error(`[SMS ERROR] To: ${phone} | ${error.message}`);
    return { success: false, error: error.message };
  }
}
