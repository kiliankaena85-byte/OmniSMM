'use server';

import { db as prisma } from "@/lib/db";
import { SettingsProvider } from "@/lib/settings";

/** @public Public legal document reader */
export async function getLegalDocumentAction(slug: string) {
  try {
    const post = await prisma.contentItem.findUnique({
      where: { slug },
      select: { title: true, contentHtml: true, isPublished: true },
    });

    if (!post) {
      return { success: false, error: "Документ не найден" };
    }

    if (!post.isPublished) {
      return { success: false, error: "Документ не опубликован" };
    }

    const { headers } = await import('next/headers');
    const { normalizeTenantId } = await import('@/lib/tenant-resolver-edge');
    const reqHeaders = await headers().catch(() => null);
    const resolvedTenantId = normalizeTenantId(reqHeaders?.get('x-tenant-id')) || 'smmplan';
    const isFlux = resolvedTenantId === 'flux';

    const settings = await SettingsProvider.getContactAndLegalSettings(resolvedTenantId);
    const defaultCompanyName = isFlux ? 'SMMflux' : 'SMMplan';
    const companyName = settings.COMPANY_NAME || defaultCompanyName;
    const inn = settings.COMPANY_INN || '';
    const ogrnip = settings.COMPANY_OGRNIP || '';
    const address = settings.COMPANY_ADDRESS || '';
    const email = isFlux ? (settings.SUPPORT_EMAIL || 'support@smmflux.ru') : (settings.SUPPORT_EMAIL || 'support@smmplan.pro');
    const privacyEmail = isFlux ? (settings.PRIVACY_EMAIL || 'privacy@smmflux.ru') : (settings.PRIVACY_EMAIL || 'privacy@smmplan.pro');
    const siteName = isFlux ? 'SMMflux' : (settings.SITE_NAME || 'SMMplan');
    const telegramBot = settings.TELEGRAM_SUPPORT_BOT 
      ? (settings.TELEGRAM_SUPPORT_BOT.startsWith('@') ? settings.TELEGRAM_SUPPORT_BOT : `@${settings.TELEGRAM_SUPPORT_BOT}`) 
      : (isFlux ? '@smmflux_support_bot' : '@smmplan_support_bot');

    let finalHtml = post.contentHtml || "";

    // Zero-Home-Address Disclosure Invariant (152-ФЗ / ст. 9 ЗоЗПП):
    if (!address.trim()) {
      finalHtml = finalHtml.replace(/<p><strong>Адрес:<\/strong>\s*\{\{COMPANY_ADDRESS\}\}<\/p>\s*/g, '');
      finalHtml = finalHtml.replace(/<p><strong>Адрес:<\/strong>[\s\S]*?<\/p>/g, '');
    }

    const { escapeHtml, sanitizeArticleHtml } = await import('@/lib/sanitize');

    finalHtml = finalHtml
      .replace(/{{COMPANY_NAME}}/g, escapeHtml(companyName))
      .replace(/{{COMPANY_INN}}/g, escapeHtml(inn || '—'))
      .replace(/{{COMPANY_OGRNIP}}/g, escapeHtml(ogrnip || '—'))
      .replace(/{{COMPANY_ADDRESS}}/g, escapeHtml(address))
      .replace(/{{SUPPORT_EMAIL}}/g, escapeHtml(email))
      .replace(/{{PRIVACY_EMAIL}}/g, escapeHtml(privacyEmail))
      .replace(/{{SITE_NAME}}/g, escapeHtml(siteName))
      .replace(/{{TELEGRAM_BOT}}/g, escapeHtml(telegramBot));

    return { success: true, data: { title: post.title, html: sanitizeArticleHtml(finalHtml) } };
  } catch (e) {
    const err = e as Error;
    return { success: false, error: err.message || "Ошибка загрузки документа" };
  }
}
