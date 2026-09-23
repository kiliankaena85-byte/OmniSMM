'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, HelpCircle, UploadCloud, Loader2, Check, Copy, Trash2 } from 'lucide-react';
import type { GeneralFormState } from './types';

interface GeneralBrandingSectionProps {
  siteName: string;
  setSiteName: (v: string) => void;
  siteDescription: string;
  setSiteDescription: (v: string) => void;
  logoUrl: string | null;
  setLogoUrl: (v: string | null) => void;
  faviconUrl: string | null;
  setFaviconUrl: (v: string | null) => void;
  logoUploading: boolean;
  faviconUploading: boolean;
  handleBrandingUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => Promise<void>;
  copyToClipboard: (text: string, fieldName: string) => void;
  copiedField: string | null;
  formState: GeneralFormState | null;
  onRemoveBranding: (type: 'logo' | 'favicon') => void;
}

export function GeneralBrandingSection({
  siteName,
  setSiteName,
  siteDescription,
  setSiteDescription,
  logoUrl,
  faviconUrl,
  logoUploading,
  faviconUploading,
  handleBrandingUpload,
  copyToClipboard,
  copiedField,
  formState,
  onRemoveBranding,
}: GeneralBrandingSectionProps) {
  return (
    <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-3 border-b border-border/50 pb-5">
        <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Брендинг & Идентичность сайта</h3>
          <p className="text-xs text-muted-foreground">
            Название, SEO-описание и графические логотипы платформы.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            Название сайта (Brand)
            <span title="Публичное название платформы. Используется в шапке, OpenGraph, title и email-уведомлениях.">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </span>
          </Label>
          <Input
            name="siteName"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="SMMplan"
            className={formState?.errors?.siteName ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {formState?.errors?.siteName && (
            <p className="text-xs font-bold text-destructive mt-1">{formState.errors.siteName[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            SEO Описание (Meta Description)
            <span title="Meta description для поисковых систем (120–160 символов). Отображается в выдаче Яндекса/Google и превью мессенджеров.">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </span>
          </Label>
          <Input
            name="siteDescription"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder="Сервис продвижения в социальных сетях №1"
            className={formState?.errors?.siteDescription ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {formState?.errors?.siteDescription && (
            <p className="text-xs font-bold text-destructive mt-1">{formState.errors.siteDescription[0]}</p>
          )}
        </div>
      </div>

      {/* Upload Logo & Favicon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Логотип платформы</Label>
          <div className="flex items-center gap-5 p-4 rounded-2xl border border-border bg-muted/10">
            <div className="w-16 h-16 rounded-xl border border-border flex items-center justify-center bg-card overflow-hidden relative shadow-inner shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
              ) : (
                <UploadCloud className="w-6 h-6 text-muted-foreground" />
              )}
              {logoUploading && (
                <div className="absolute inset-0 bg-background/85 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <input
                type="file"
                id="logo-file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                className="hidden"
                onChange={(e) => handleBrandingUpload(e, 'logo')}
                disabled={logoUploading}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="logo-file"
                  className="inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                >
                  Загрузить лого
                </label>
                {logoUrl && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(logoUrl, 'logo')}
                      className="h-8 px-2.5 text-xs gap-1"
                      title="Скопировать URL логотипа"
                    >
                      {copiedField === 'logo' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Копировать URL</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveBranding('logo')}
                      className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 gap-1"
                      title="Удалить логотип"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">PNG, SVG, WEBP до 2 МБ</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Фавикон браузера</Label>
          <div className="flex items-center gap-5 p-4 rounded-2xl border border-border bg-muted/10">
            <div className="w-16 h-16 rounded-xl border border-border flex items-center justify-center bg-card overflow-hidden relative shadow-inner shrink-0">
              {faviconUrl ? (
                <img src={faviconUrl} alt="Favicon" className="w-8 h-8 object-contain" />
              ) : (
                <UploadCloud className="w-6 h-6 text-muted-foreground" />
              )}
              {faviconUploading && (
                <div className="absolute inset-0 bg-background/85 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <input
                type="file"
                id="favicon-file"
                accept=".png,.jpg,.jpeg,.webp,.svg,.ico"
                className="hidden"
                onChange={(e) => handleBrandingUpload(e, 'favicon')}
                disabled={faviconUploading}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="favicon-file"
                  className="inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                >
                  Загрузить иконку
                </label>
                {faviconUrl && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(faviconUrl, 'favicon')}
                      className="h-8 px-2.5 text-xs gap-1"
                      title="Скопировать URL фавикона"
                    >
                      {copiedField === 'favicon' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Копировать URL</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveBranding('favicon')}
                      className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 gap-1"
                      title="Удалить фавикон"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">ICO, SVG, PNG до 500 КБ</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
