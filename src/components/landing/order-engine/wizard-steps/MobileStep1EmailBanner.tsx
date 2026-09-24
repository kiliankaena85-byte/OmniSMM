import React from "react";
import { Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface MobileStep1EmailBannerProps {
  isEmailDetected: boolean;
  url: string;
  setEmail: (email: string) => void;
  setUrl: (url: string) => void;
  localUrlError: string | null;
  setLocalUrlError: (error: string | null) => void;
}

export function MobileStep1EmailBanner({
  isEmailDetected,
  url,
  setEmail,
  setUrl,
  localUrlError,
  setLocalUrlError,
}: MobileStep1EmailBannerProps) {
  return (
    <AnimatePresence>
      {isEmailDetected && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="mb-2 bg-primary/10 border border-primary/20 rounded-2xl p-3 flex flex-col gap-3 shadow-md relative z-30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <Mail className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Это email-адрес</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">Сохранить для связи?</p>
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              size="sm"
              onClick={() => {
                setEmail(url.trim());
                setUrl("");
                if (localUrlError) setLocalUrlError(null);
                toast.success("Email сохранен! Теперь вставьте ссылки на продвижение.");
              }}
              className="flex-1 bg-primary text-primary-foreground font-bold rounded-xl h-9"
            >
              Да, запомнить
            </Button>
            <Button
              size="sm"
              intent="ghost"
              onClick={() => {
                setUrl("");
                if (localUrlError) setLocalUrlError(null);
              }}
              className="flex-1 text-muted-foreground hover:text-foreground font-bold h-9 bg-muted/50 hover:bg-muted"
            >
              Нет, очистить
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
