"use client";

import { motion, useInView } from "motion/react";
import type { Variants } from "motion/react";
import React, { useRef } from "react";

interface InViewProps {
  children: React.ReactNode;
  variants?: Variants;
  transition?: object;
  once?: boolean;
  margin?: string;
  className?: string;
  delay?: number;
}

const defaultVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export function InView({
  children,
  variants = defaultVariants,
  transition = { duration: 0.6, ease: "easeOut" },
  once = true,
  margin = "0px 0px -100px 0px",
  className,
  delay = 0,
}: InViewProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: margin as any });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={{ ...transition, delay }}
    >
      {children}
    </motion.div>
  );
}