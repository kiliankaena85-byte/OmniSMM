import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black tracking-wider uppercase transition-colors outline-none",
  {
    variants: {
      intent: {
        primary: "border-transparent bg-primary text-primary-foreground shadow-md hover:opacity-80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:opacity-80",
        outline: "text-foreground border-border",
        gradient: "border-transparent bg-gradient-to-r from-primary to-indigo-500 text-primary-foreground shadow-md hover:opacity-80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-md hover:opacity-80",
      },
    },
    defaultVariants: {
      intent: "primary",
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, intent, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ intent }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
