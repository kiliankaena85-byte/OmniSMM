'use client';

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface LegalCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: "all" | "terms" | "privacy";
  className?: string;
  labelClassName?: string;
  hasError?: boolean;
  onOpenDocument?: (slug: string) => void;
}

export function LegalCheckbox({
  id,
  checked,
  onChange,
  variant = "all",
  className = "",
  labelClassName = "",
  hasError = false,
  onOpenDocument,
}: LegalCheckboxProps) {
  return (
    <div className="space-y-1 w-full">
      <label
        className={`flex items-start gap-2.5 cursor-pointer py-1.5 min-h-[44px] select-none group ${hasError && !checked ? 'p-1 rounded-xl bg-danger/5 border border-danger/20 transition-all' : ''} ${className}`}
      >
        {/* Native hidden input overlayed on custom styled animated checkbox */}
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0 mt-0.5">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 focus:outline-none"
          />
          <motion.div
            animate={{
              scale: checked ? 1.05 : 1,
              borderColor: hasError && !checked ? "var(--color-danger)" : checked ? "var(--color-primary)" : "var(--color-border)",
              backgroundColor: checked ? "var(--color-primary)" : "transparent",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shadow-sm ${
              hasError && !checked 
                ? "!border-danger ring-2 ring-danger/40 animate-shake" 
                : checked
                  ? "border-primary bg-primary"
                  : "border-border group-hover:border-primary/70"
            }`}
          >
            <AnimatePresence initial={false}>
              {checked && (
                <motion.svg
                width="12"
                height="10"
                viewBox="0 0 12 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
              >
                <path
                  d="M1.5 5L4.5 8L10.5 2"
                  stroke="var(--color-primary-foreground)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <span className={`text-xs leading-snug text-left text-foreground font-semibold select-none ${labelClassName}`}>
        {variant === "terms" && (
          <>
            Я согласен с условиями{" "}
            <Link
              href={ROUTES.LEGAL.TERMS}
              target="_blank"
              className="underline text-primary hover:text-primary-600 transition-colors font-extrabold"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDocument) {
                  e.preventDefault();
                  onOpenDocument("terms");
                }
              }}
            >
              Договора публичной оферты
            </Link>
          </>
        )}

        {variant === "privacy" && (
          <>
            Я даю согласие на обработку персональных данных в соответствии с{" "}
            <Link
              href={ROUTES.LEGAL.PRIVACY}
              target="_blank"
              className="underline text-primary hover:text-primary-600 transition-colors font-extrabold"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDocument) {
                  e.preventDefault();
                  onOpenDocument("privacy");
                }
              }}
            >
              Политикой конфиденциальности (152-ФЗ)
            </Link>
          </>
        )}

        {variant === "all" && (
          <>
            Я согласен с{" "}
            <Link
              href={ROUTES.LEGAL.TERMS}
              target="_blank"
              className="underline text-primary hover:text-primary-600 transition-colors font-extrabold"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDocument) {
                  e.preventDefault();
                  onOpenDocument("terms");
                }
              }}
            >
              Офертой
            </Link>{" "}
            и{" "}
            <Link
              href={ROUTES.LEGAL.PRIVACY}
              target="_blank"
              className="underline text-primary hover:text-primary-600 transition-colors font-extrabold"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDocument) {
                  e.preventDefault();
                  onOpenDocument("privacy");
                }
              }}
            >
              Политикой конфиденциальности
            </Link>
          </>
        )}
      </span>
    </label>
    {hasError && !checked && (
      <p className="text-[11px] font-bold text-danger pl-8 animate-in fade-in duration-200">
        Обязательно для оформления заказа (требование 152-ФЗ)
      </p>
    )}
  </div>
  );
}
