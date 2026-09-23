'use client';

import React, { useState, useEffect } from "react";
import { X, Loader2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getLegalDocumentAction } from "@/actions/order/legal";

interface LegalDocumentModalProps {
  slug: string | null;
  onClose: () => void;
}

export function LegalDocumentModal({ slug, onClose }: LegalDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [documentData, setDocumentData] = useState<{ title: string; html: string } | null>(null);

  useEffect(() => {
    if (slug) {
      setLoading(true);
      getLegalDocumentAction(slug)
        .then((res) => {
          if (res.success && res.data) {
            setDocumentData(res.data);
          } else {
            // Fallback: open document in new tab if database fetch fails
            window.open(`/legal/${slug}`, "_blank");
            onClose();
          }
        })
        .catch(() => {
          // Fallback on network error
          window.open(`/legal/${slug}`, "_blank");
          onClose();
        })
        .finally(() => {
          setLoading(false);
        });
      
      document.body.style.overflow = "hidden";
    } else {
      setDocumentData(null);
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [slug]);

  if (!slug) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-end md:items-center justify-center p-0 md:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-foreground/40 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal content container */}
        <motion.div
          initial={{ y: "100%", opacity: 0, scale: 1 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full md:max-w-2xl bg-card border border-border shadow-[0_20px_60px_rgba(0,0,0,0.15)] rounded-t-3xl md:rounded-3xl p-5 md:p-6 z-10 flex flex-col h-[85vh] md:h-[75vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <FileText className="w-5 h-5 text-primary shrink-0" />
              </div>
              <h3 className="text-base font-black text-foreground line-clamp-1">
                {loading ? "Загрузка..." : documentData?.title || "Документ"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto py-4 pr-1 min-h-0 text-sm leading-relaxed text-muted-foreground">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : documentData ? (
              <div
                className="prose dark:prose-invert max-w-none prose-sm prose-slate"
                dangerouslySetInnerHTML={{ __html: documentData.html }}
              />
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
