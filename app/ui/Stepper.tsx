"use client";

import React, {
  useState,
  Children,
  useRef,
  useLayoutEffect,
  HTMLAttributes,
  ReactNode,
} from "react";
import { motion, AnimatePresence, Variants } from "motion/react";

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  disableStepIndicators?: boolean;
  canProceed?: (step: number) => boolean;
  /** Conteúdo extra exibido na barra fixa inferior no mobile (ex.: total da nota). */
  resumoMobile?: ReactNode;
  /** Cabeçalho opcional dentro do card, acima dos indicadores (ex.: título + total). */
  cabecalho?: ReactNode;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  backButtonText = "Voltar",
  nextButtonText = "Continuar",
  completeButtonText = "Concluir",
  disableStepIndicators = false,
  canProceed,
  resumoMobile,
  cabecalho,
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;
  const bloqueado = canProceed ? !canProceed(currentStep) : false;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) onFinalStepCompleted();
    else onStepChange(newStep);
    // Rola o topo do card pra vista ao trocar de passo (mobile).
    if (newStep <= totalSteps && typeof window !== "undefined") {
      requestAnimationFrame(() =>
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };
  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };
  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div className="w-full scroll-mt-20" ref={rootRef} {...rest}>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_30px_rgba(16,24,40,0.06)]">
        {cabecalho && (
          <div className="border-b border-[var(--border)] px-4 py-3 sm:px-8">{cabecalho}</div>
        )}
        <div className="flex w-full items-center gap-2 bg-gradient-to-r from-slate-50 to-white px-4 py-5 sm:px-8 sm:py-6">
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <React.Fragment key={stepNumber}>
                <StepIndicator
                  step={stepNumber}
                  disableStepIndicators={disableStepIndicators}
                  currentStep={currentStep}
                  onClickStep={(clicked) => {
                    if (clicked > currentStep) return; // só permite voltar clicando
                    setDirection(-1);
                    updateStep(clicked);
                  }}
                />
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </div>

        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          className="px-4 sm:px-8"
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted && (
          <div
            className={
              "px-4 pb-6 sm:px-8 sm:pb-8 " +
              // Mobile: barra fixa no rodapé, no alcance do polegar.
              "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:border-t max-lg:border-[var(--border)] " +
              "max-lg:bg-[var(--surface)]/95 max-lg:px-4 max-lg:pt-3 max-lg:shadow-[0_-4px_24px_rgba(16,24,40,0.10)] max-lg:backdrop-blur " +
              "max-lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            }
          >
            {resumoMobile && (
              <div className="mb-2.5 flex items-center justify-between lg:hidden">{resumoMobile}</div>
            )}
            <div className={`flex gap-3 sm:mt-6 ${currentStep !== 1 ? "justify-between" : "justify-end"}`}>
              {currentStep !== 1 && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBack}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 max-lg:border max-lg:border-[var(--border)]"
                >
                  ← {backButtonText}
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: bloqueado ? 1 : 1.03 }}
                whileTap={{ scale: bloqueado ? 1 : 0.97 }}
                onClick={isLastStep ? handleComplete : handleNext}
                disabled={bloqueado}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(82,39,255,0.35)] transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:flex-none"
              >
                {isLastStep ? completeButtonText : nextButtonText} →
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepContentWrapperProps {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className = "",
}: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);
  return (
    <motion.div
      style={{ position: "relative", overflow: "hidden" }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: "spring", duration: 0.4 }}
      className={className}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={(h) => setParentHeight(h)}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface SlideTransitionProps {
  children: ReactNode;
  direction: number;
  onHeightReady: (height: number) => void;
}

function SlideTransition({ children, direction, onHeightReady }: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (containerRef.current) onHeightReady(containerRef.current.offsetHeight);
  }, [children, onHeightReady]);
  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.4 }}
      className="absolute left-0 right-0 top-0 px-4 pb-2 pt-6 sm:px-8"
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: "0%", opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-50%" : "50%", opacity: 0 }),
};

export function Step({ children }: { children: ReactNode }) {
  return <div className="w-full">{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  onClickStep: (clicked: number) => void;
  disableStepIndicators?: boolean;
}

function StepIndicator({ step, currentStep, onClickStep, disableStepIndicators = false }: StepIndicatorProps) {
  const status = currentStep === step ? "active" : currentStep < step ? "inactive" : "complete";
  return (
    <motion.div
      onClick={() => {
        if (step !== currentStep && !disableStepIndicators) onClickStep(step);
      }}
      className="relative cursor-pointer outline-none"
      animate={status}
      initial={false}
    >
      <motion.div
        variants={{
          inactive: { scale: 1, backgroundColor: "#e2e8f0", color: "#94a3b8" },
          active: { scale: 1.1, backgroundColor: "#5227ff", color: "#ffffff" },
          complete: { scale: 1, backgroundColor: "#5227ff", color: "#ffffff" },
        }}
        transition={{ duration: 0.3 }}
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold shadow-sm"
      >
        {status === "complete" ? (
          <CheckIcon className="h-4 w-4 text-white" />
        ) : (
          <span>{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  const lineVariants: Variants = {
    incomplete: { width: 0 },
    complete: { width: "100%" },
  };
  return (
    <div className="relative h-1 flex-1 overflow-hidden rounded bg-slate-200">
      <motion.div
        className="absolute left-0 top-0 h-full bg-[var(--primary)]"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? "complete" : "incomplete"}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.1, type: "tween", ease: "easeOut", duration: 0.3 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
