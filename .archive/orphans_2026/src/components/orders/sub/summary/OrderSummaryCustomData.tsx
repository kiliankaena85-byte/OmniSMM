import React from 'react';
import type { PublicService } from '@/actions/order/catalog';
import { inputCls } from './types';

interface OrderSummaryCustomDataProps {
  selectedService: PublicService;
  customData: string;
  setCustomData: (value: string) => void;
}

export function OrderSummaryCustomData({
  selectedService,
  customData,
  setCustomData,
}: OrderSummaryCustomDataProps) {
  const sName = selectedService.name.toLowerCase();
  const cType = selectedService.customDataType;
  const isCustomComments =
    cType === 'TEXTAREA' || sName.includes('свои') || sName.includes('свой текст');
  const isKeywords = cType === 'TEXT' || sName.includes('ключево');
  const isPoll =
    cType === 'NUMBER' ||
    (sName.includes('опрос') && !sName.includes('просмотр')) ||
    sName.includes('голосование');
  const isLiveStream = sName.includes('зрител') || sName.includes('эфир');
  const isPrivateChannel = sName.includes('закрыт');
  const customFieldLabel =
    selectedService?.customDataLabel?.trim() ||
    (isCustomComments
      ? 'Ваши комментарии (по одному в строке)'
      : isKeywords
        ? 'Ключевые слова (через запятую)'
        : isPoll
          ? 'Номер варианта ответа'
          : null);

  if (!isLiveStream && !isPrivateChannel && !isCustomComments && !isKeywords && !isPoll) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {isLiveStream && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold p-3 rounded-lg flex items-start gap-2">
          <span className="text-base leading-none">⚡</span>
          Внимание! Услуга только для запущенного стрима. Если стрим прервется — гарантия сгорает.
        </div>
      )}
      {isPrivateChannel && (
        <div className="bg-warning/10 border border-warning/20 text-warning-text text-xs font-bold p-3 rounded-lg flex items-start gap-2">
          <span className="text-base leading-none">⚠️</span>
          Услуга для закрытых каналов. В поле &quot;Ссылка&quot; указывайте только пригласительную ссылку (t.me/+...).
        </div>
      )}

      {/* Inputs */}
      {isCustomComments && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {customFieldLabel}
          </label>
          <textarea
            value={customData}
            onChange={(e) => setCustomData(e.target.value)}
            placeholder={'Супер!\nОтличное видео!\nСогласен.'}
            className={`${inputCls} text-base min-h-[100px] py-3 px-4 resize-y`}
            required
          />
        </div>
      )}
      {(isKeywords || isPoll) && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {customFieldLabel}
          </label>
          <input
            type="text"
            value={customData}
            onChange={(e) => setCustomData(e.target.value)}
            placeholder={isPoll ? 'Например: 2' : 'блог, новости, инвестиции'}
            inputMode={isPoll ? 'numeric' : 'text'}
            className={`${inputCls} text-base h-12 px-4`}
            required
          />
        </div>
      )}
    </div>
  );
}
