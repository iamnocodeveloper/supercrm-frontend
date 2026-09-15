export const CHANNEL_MESSAGE_COSTS = {
  internal: 0.00445 * 1.60,
  twilio: 0.064,
  whatsappApi: 0.064 * 0.70,
} as const;

export type RecommendedChannelInput = {
  twilioCost?: number;
  whatsappApiCost?: number;
  whatsappQrActive?: boolean;
  whatsappApiActive?: boolean;
  twilioActive?: boolean;
  telegramActive?: boolean;
  campaignSize?: number;
};

export const getRecommendedChannel = ({
  twilioCost = 0,
  whatsappApiCost = 0,
  whatsappQrActive = false,
  whatsappApiActive = false,
  twilioActive = false,
  telegramActive = false,
  campaignSize = 0,
}: RecommendedChannelInput) => {
  if (whatsappApiActive && (campaignSize >= 100 || twilioCost > whatsappApiCost || !twilioActive)) return 'WhatsApp API';
  if (whatsappQrActive) return 'WhatsApp QR';
  if (twilioActive) return twilioCost > 150 && whatsappApiActive ? 'WhatsApp API' : 'Twilio';
  if (telegramActive) return 'Telegram';
  return 'Sin canal activo';
};

export const formatUsd = (value: number) => `$${value.toFixed(2)} USD`;