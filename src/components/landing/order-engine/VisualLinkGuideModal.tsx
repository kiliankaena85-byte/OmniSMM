'use client';

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Monitor } from "lucide-react";
import { Platform, ContentType, DeviceType } from "./guides/types";
import { GuideTabs } from "./guides/GuideTabs";
import { GuideSteps } from "./guides/GuideSteps";
import { GuideFooter } from "./guides/GuideFooter";

interface VisualLinkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: string;
  initialContentType?: ContentType;
}


export function VisualLinkGuideModal({ isOpen, onClose, initialPlatform, initialContentType }: VisualLinkGuideModalProps) {
  const [platform, setPlatform] = useState<Platform>("telegram");
  const [contentType, setContentType] = useState<ContentType>("profile");
  const [deviceTab, setDeviceTab] = useState<DeviceType>("mobile");

  // Sync state with parent's detected platform context
  useEffect(() => {
    if (initialPlatform) {
      const lowered = initialPlatform.toLowerCase();
      if (lowered.includes("instagram") || lowered.includes("inst")) {
        setPlatform("instagram");
        setContentType(initialContentType || "profile");
      } else if (lowered.includes("telegram") || lowered.includes("tg")) {
        setPlatform("telegram");
        setContentType(initialContentType || "profile");
      } else if (lowered.includes("vk")) {
        setPlatform("vk");
        setContentType(initialContentType || "profile");
      }
    } else if (initialContentType) {
      setContentType(initialContentType);
    }
  }, [initialPlatform, initialContentType, isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="bg-card/95 dark:bg-card/75 backdrop-blur-xl border border-border/80 rounded-[32px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.3)] p-5 sm:p-8 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/40 pb-5 gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                Интерактивный гид по ссылкам
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
                Выберите соцсеть и тип контента, чтобы увидеть пошаговую инструкцию
              </p>
            </div>
            
            {/* Devices Selector & Close */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex p-0.5 bg-background/60 border border-border/50 rounded-xl shrink-0">
                <button
                  onClick={() => setDeviceTab("mobile")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                    deviceTab === "mobile"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Телефон
                </button>
                <button
                  onClick={() => setDeviceTab("desktop")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                    deviceTab === "desktop"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Компьютер
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-default-100 hover:bg-default-200 dark:bg-default-100/10 dark:hover:bg-default-100/20 flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0"
              >
                <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>

          <GuideTabs 
            platform={platform} 
            setPlatform={setPlatform} 
            contentType={contentType} 
            setContentType={setContentType} 
          />

          {/* Dynamic Instructions Grid */}
          <div className="py-4 sm:py-6">
            <GuideSteps platform={platform} contentType={contentType} device={deviceTab} />
          </div>

          {/* Warning and Tips Footer */}
          <GuideFooter platform={platform} contentType={contentType} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
