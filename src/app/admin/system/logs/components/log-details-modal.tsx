'use client';

import { useState } from 'react';
import { Copy, Check, ShieldAlert } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";

interface LogDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  data: unknown;
}

export function LogDetailsModal({
  isOpen,
  onClose,
  title,
  subtitle,
  data,
}: LogDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  const formattedData = typeof data === 'string'
    ? data
    : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write error
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="3xl" scrollBehavior="inside">
      <ModalContent>
        {(onCloseContent) => (
          <>
            <ModalHeader className="flex flex-col gap-1 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">{subtitle}</p>
                  )}
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="p-5 font-mono text-xs text-foreground bg-muted/20">
              <pre className="whitespace-pre-wrap break-all rounded-lg p-4 bg-background border border-border/80 leading-relaxed max-h-[50vh] overflow-y-auto">
                {formattedData || 'Данные отсутствуют'}
              </pre>
            </ModalBody>
            <ModalFooter className="border-t border-border bg-muted/30">
              <Button
                variant="flat"
                size="sm"
                className="font-medium mr-auto"
                onPress={handleCopy}
                startContent={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
              <Button color="secondary" variant="flat" onPress={onCloseContent}>
                Закрыть
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
