import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-500 ease-out outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      intent: {
        primary: "bg-primary text-primary-foreground shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] hover:opacity-90 hover:shadow-[0_6px_20px_rgb(0,0,0,0.15)]",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-80",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm",
        outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground text-foreground/80",
        glass: "bg-card/10 backdrop-blur-md border border-white/20 text-primary-foreground hover:bg-card/20",
        dark: "bg-foreground text-background shadow-md hover:opacity-90",
        tint: "bg-primary/10 text-primary hover:bg-primary/20", // The pure blue accent used sparingly
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-14 rounded-2xl px-10 text-lg font-semibold",
        icon: "h-11 w-11",
      },
      isAnimated: {
        true: "group transform-gpu hover:-translate-y-[1px]",
        false: "",
      }
    },
    defaultVariants: {
      intent: "primary",
      size: "default",
      isAnimated: false,
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  variant?: VariantProps<typeof buttonVariants>['intent'];
}

const Button = ({ className, intent, variant, size, isAnimated, asChild = false, ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const Comp = asChild ? Slot : "button"
  const resolvedIntent = intent || variant || "primary"
  return (
    <Comp
      className={cn(buttonVariants({ intent: resolvedIntent, size, isAnimated, className }))}
      ref={ref}
      {...props}
    />
  )
}
Button.displayName = "Button"

export { Button, buttonVariants }
