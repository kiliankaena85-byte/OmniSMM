'use client';

import React, { useState, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Card, Button, Checkbox } from '@heroui/react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { getEmployeeConsentStatusAction, acceptEmployeeResponsibilityConsentAction } from '@/actions/admin/legal-consent';

export function EmployeeConsentModalGuard({ children }: { children: React.ReactNode }) {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [docDetails, setDocDetails] = useState<{ documentVersion: string; documentText: string; documentHash: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkConsent() {
      try {
        const res = await getEmployeeConsentStatusAction();
        if (res.success) {
          setHasConsent(res.hasConsented);
          setDocDetails({
            documentVersion: res.documentVersion,
            documentText: res.documentText,
            documentHash: res.documentHash
          });
          if (!res.hasConsented) {
            setIsOpen(true);
          }
        }
      } catch {
        // Non-staff user or missing permission
        setHasConsent(true);
      }
    }
    checkConsent();
  }, []);

  const handleAccept = async () => {
    if (!isChecked) return;
    setLoading(true);
    try {
      const res = await acceptEmployeeResponsibilityConsentAction();
      if (res.success) {
        setHasConsent(true);
        setIsOpen(false);
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : String(err)) || 'Ошибка принятия согласия');
    } finally {
      setLoading(false);
    }
  };

  if (hasConsent === null) {
    return null;
  }

  return (
    <>
      {children}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border text-card-foreground rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 text-lg font-semibold border-b border-border p-6 pb-4 shrink-0">
              <ShieldAlert className="w-6 h-6 text-primary shrink-0" />
              Юридический регламент финансовой ответственности сотрудников
            </div>
            
            <div className="p-6 py-4 overflow-y-auto min-h-0 space-y-4">
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Для получения доступа к финансовым операциям (компенсациям, списаниям и докрутам) необходимо ознакомиться и подтвердить согласие с регламентом персональной материальной ответственности в соответствии с законодательством РФ.
                </p>
              </div>

              <div className="p-4 bg-muted/50 text-foreground text-xs leading-relaxed border border-border rounded-lg">
                <div className="font-mono text-[10px] text-muted-foreground mb-2">
                  Версия: {docDetails?.documentVersion} | Hash SHA-256: {docDetails?.documentHash.substring(0, 16)}...
                </div>
                <p className="whitespace-pre-line">{docDetails?.documentText}</p>
              </div>

              <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent-check"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="consent-check" className="text-xs cursor-pointer select-none">
                  Я подтверждаю, что ознакомлен(а) с регламентом финансовой ответственности сотрудников службы поддержки. Я понимаю, что все начисления, списания и компенсации логируются и проверяются супервизорами.
                </label>
              </div>
            </div>

            <div className="flex justify-end p-6 pt-4 border-t border-border shrink-0">
              <button
                disabled={!isChecked || loading}
                onClick={handleAccept}
                className="px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Сохранение...' : 'Подтвердить согласие и продолжить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
