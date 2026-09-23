import type { Variants } from "framer-motion";

export const slideVariants: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 15 : -15,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    y: direction < 0 ? 15 : -15,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: "easeIn"
    }
  })
};

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { 
    opacity: 1, 
    transition: { 
      staggerChildren: 0.025,
      delayChildren: 0.01
    } 
  }
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.18,
      ease: "easeOut"
    }
  }
};
