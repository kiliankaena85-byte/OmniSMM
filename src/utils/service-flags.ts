/**
 * Service UI Flags Utility (OmniSMM 1.0 SIL-2026)
 * Extracts custom comments, polls, stream, and private flags from a selected Service.
 */

export interface ServiceFlagsDTO {
  isCustomComments: boolean;
  isPoll: boolean;
  isLiveStream: boolean;
  isPrivateChannel: boolean;
  customFieldLabel: string | null;
}

export function getServiceFlags(selectedService: {
  name?: string | null;
  customDataType?: string | null;
  customDataLabel?: string | null;
  features?: unknown;
  [key: string]: unknown;
} | null | undefined): ServiceFlagsDTO {
  const sName = selectedService?.name?.toLowerCase() || '';
  const cType = selectedService?.customDataType;

  const isCustomComments = cType === 'TEXTAREA' || sName.includes('свои') || sName.includes('свой текст');
  const isKeywords = cType === 'TEXT' || sName.includes('ключево');
  const isPoll = cType === 'NUMBER' || (sName.includes('опрос') && !sName.includes('просмотр')) || sName.includes('голосование');
  const isLiveStream = sName.includes('зрител') || sName.includes('эфир') || sName.includes('трансляц');
  const isPrivateChannel = sName.includes('закрыт');

  const customFieldLabel = selectedService?.customDataLabel?.trim() || (
    isCustomComments ? 'Ваши комментарии (по одному в строке)'
    : isKeywords ? 'Ключевые слова (через запятую)'
    : isPoll ? 'Номер варианта ответа'
    : null
  );

  return {
    isCustomComments,
    isPoll,
    isLiveStream,
    isPrivateChannel,
    customFieldLabel,
  };
}
