"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Anima entrada E saída ao cruzar a viewport (reversível no scroll up/down).
// once:false faz o motion voltar ao estado inicial quando a seção sai de vista.
// amount:"some" (e não uma fração) porque seções altas — os planos empilhados no
// mobile passam da altura da tela — nunca chegariam a mostrar 20% de si mesmas e
// ficariam presas em opacity 0.
export default function SectionReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: false, amount: "some", margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
