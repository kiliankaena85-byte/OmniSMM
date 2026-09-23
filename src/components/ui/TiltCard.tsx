'use client';

import React from "react";
import { motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";

export interface TiltCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  tiltAngle?: number;
  className?: string;
}

export function TiltCard({
  children,
  tiltAngle = 10,
  className = "",
  ...props
}: TiltCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [`${tiltAngle}deg`, `-${tiltAngle}deg`]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [`-${tiltAngle}deg`, `${tiltAngle}deg`]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXPos = e.clientX - rect.left;
    const mouseYPos = e.clientY - rect.top;
    const xPct = mouseXPos / width - 0.5;
    const yPct = mouseYPos / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`[perspective:1000px] transition-transform duration-200 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
