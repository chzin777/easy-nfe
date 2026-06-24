"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Wrapper client p/ os cards de plano: entrada com spring + leve scale no hover.
// O conteúdo (cores, textos) vem renderizado do server — só animamos o container.
export default function MotionCard({
  className,
  children,
  index = 0,
}: {
  className?: string;
  children: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: "spring", duration: 0.5, delay: index * 0.08 }}
      whileHover={{ scale: 1.03 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
