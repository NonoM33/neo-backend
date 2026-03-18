import { sendSms } from '../../lib/sms';

interface TrackingSmsParams {
  phoneNumber: string;
  clientFirstName: string;
  auditorName: string;
  appointmentTime: string;
  trackingUrl: string;
  clientId?: string;
  appointmentId: string;
}

/**
 * Send tracking SMS to client
 */
export async function sendTrackingSms(params: TrackingSmsParams): Promise<{ success: boolean; error?: string }> {
  const message = `Bonjour ${params.clientFirstName}, votre auditeur ${params.auditorName} est en route pour votre RDV de ${params.appointmentTime}.\nSuivez sa position en temps réel: ${params.trackingUrl}`;

  const result = await sendSms({
    phoneNumber: params.phoneNumber,
    message,
    clientId: params.clientId,
    context: 'tracking',
    contextId: params.appointmentId,
  });

  return result;
}
