import { fail, type OfflineHandler } from './types';
export const handleWhatsappChannel: OfflineHandler = (request) =>
  request.path.startsWith('/api/v1/account/whatsapp')
    ? fail(
        503,
        'WhatsApp recipient verification and delivery require the connected API. Use Share on a public story for manual sharing; nothing was queued on this device.',
      )
    : null;
