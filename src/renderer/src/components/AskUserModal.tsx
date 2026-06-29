import { useState, useRef, useEffect, useMemo } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

export interface AskUserStep {
  header: string;
  question: string;
  type: "choice" | "text" | "yesno";
  options?: { label: string; description: string }[];
  multiSelect?: boolean;
  placeholder?: string;
}

export function AskUserModal({
  pendingQuestion,
  onResolve,
  activeColor,
}: {
  pendingQuestion: { questions: AskUserStep[]; resolve: (ans: any[]) => void } | null;
  onResolve: (ans: any[]) => void;
  activeColor?: string;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);

  const steps = pendingQuestion?.questions || [];
  const step = steps[currentStep];
  const workspaceColor = activeColor || "var(--button-primary-base)";

  const options = useMemo(() => {
    if (!step) return [];
    if (step.type === "yesno")
      return [
        { label: "Yes", description: "Confirm the action or choice" },
        { label: "No", description: "Decline or skip" },
      ];
    return step.options || [];
  }, [step]);

  useEffect(() => {
    if (pendingQuestion) {
      setCurrentStep(0);
      setAnswers([]);
      resetStep();
    }
  }, [pendingQuestion]);

  const resetStep = () => {
    setInputValue("");
    setSelectedIndices([]);
    setHighlightedIdx(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (choicesRef.current && choicesRef.current.children[highlightedIdx]) {
      const activeEl = choicesRef.current.children[highlightedIdx] as HTMLElement;
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIdx]);

  const handleNext = (finalValue?: any) => {
    let currentAnswer = finalValue;
    if (currentAnswer === undefined) {
      if (step.type === "choice" || step.type === "yesno") {
        if (step.multiSelect && step.type === "choice") {
          currentAnswer = selectedIndices.map((i) => options[i].label);
          if (inputValue.trim()) currentAnswer.push(inputValue.trim());
        } else {
          currentAnswer =
            highlightedIdx >= 0 && highlightedIdx < options.length
              ? options[highlightedIdx].label
              : inputValue.trim();
        }
      } else {
        currentAnswer = inputValue.trim();
      }
    }

    const newAnswers = [...answers, currentAnswer];
    if (currentStep < steps.length - 1) {
      setAnswers(newAnswers);
      setCurrentStep((prev) => prev + 1);
      resetStep();
    } else {
      onResolve(newAnswers);
    }
  };

  useEffect(() => {
    if (!pendingQuestion) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" && options.length > 0) {
        e.preventDefault();
        setHighlightedIdx((prev) => (prev + 1) % (options.length + (step.type !== "text" ? 0 : 0)));
      } else if (e.key === "ArrowUp" && options.length > 0) {
        e.preventDefault();
        setHighlightedIdx((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (step.type === "choice" && step.multiSelect && e.ctrlKey) {
          handleNext();
        } else if (step.type === "choice" && step.multiSelect) {
          toggleSelection(highlightedIdx);
        } else {
          handleNext();
        }
      } else if (e.key === " " && step.type === "choice" && step.multiSelect) {
        e.preventDefault();
        toggleSelection(highlightedIdx);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onResolve([]); // Resolve with empty array to signify cancellation
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [pendingQuestion, options, highlightedIdx, inputValue, currentStep, selectedIndices]);

  const toggleSelection = (idx: number) => {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  if (!pendingQuestion || !step) return null;

  const isNextDisabled =
    step.type === "choice" &&
    step.multiSelect &&
    selectedIndices.length === 0 &&
    !inputValue.trim();

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.38)",
          backdropFilter: "blur(1px)",
        }}
      />
      <div
        tabIndex={0}
        style={{
          position: "fixed",
          top: "64px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "420px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 96px)",
          background: "#121212",
          border: "1px solid #242428",
          borderRadius: 4,
          boxShadow: "0 14px 32px rgba(0,0,0,0.55)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
        }}
      >
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #202024", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div
              style={{
                fontSize: "9px",
                fontWeight: "800",
                textTransform: "uppercase",
                color: workspaceColor,
                border: `1px solid ${workspaceColor}`,
                padding: "2px 5px",
                borderRadius: 2,
                letterSpacing: "0.05em",
              }}
            >
              {step.header}
            </div>
            <div style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-weaker)" }}>
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>

          <div style={{ color: "var(--text-strong)", fontSize: 12, lineHeight: 1.5 }}>
            <MarkdownRenderer content={step.question} />
          </div>

          {(step.type === "text" || options.length > 0) && (
            <div style={{ marginTop: 12 }}>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  step.placeholder ||
                  (options.length > 0 ? "Or type your own answer..." : "Type your response...")
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 9px",
                  borderRadius: 3,
                  border: "1px solid #2a2a30",
                  background: "#151515",
                  color: "var(--text-strong)",
                  fontSize: 12,
                  outline: "none",
                  boxShadow: "none",
                }}
              />
            </div>
          )}
        </div>

        {options.length > 0 && (
          <div ref={choicesRef} style={{ overflowY: "auto", flex: 1, padding: 4 }}>
            {options.map((option, idx) => {
              const isHighlighted = idx === highlightedIdx;
              const isSelected = selectedIndices.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() =>
                    step.multiSelect ? toggleSelection(idx) : handleNext(option.label)
                  }
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    padding: "7px 9px",
                    borderRadius: 3,
                    background: isHighlighted
                      ? "var(--surface-base)"
                      : isSelected
                        ? "#1a1a1a"
                        : "transparent",
                    color: isHighlighted || isSelected ? "var(--text-strong)" : "var(--text-weak)",
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                    borderLeft: `2px solid ${isHighlighted ? workspaceColor : isSelected ? `${workspaceColor}88` : "transparent"}`,
                    gap: 8,
                  }}
                >
                  {step.multiSelect && (
                    <div
                      style={{
                        marginTop: 3,
                        width: 13,
                        height: 13,
                        borderRadius: 2,
                        border: `1px solid ${isSelected ? workspaceColor : "var(--border-base)"}`,
                        background: isSelected ? workspaceColor : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="4"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: isHighlighted || isSelected ? 600 : 400 }}>
                      {option.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-weaker)", marginTop: 2 }}>
                      {option.description}
                    </div>
                  </div>
                  {isHighlighted && !step.multiSelect && (
                    <span
                      style={{
                        fontSize: 10,
                        opacity: 0.55,
                        background: "#151515",
                        padding: "2px 5px",
                        borderRadius: 2,
                        alignSelf: "center",
                      }}
                    >
                      Enter
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div
          style={{
            padding: "8px 12px",
            background: "#131313",
            borderTop: "1px solid #202024",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "10px", color: "var(--text-weaker)", fontWeight: 500 }}>
            {step.multiSelect
              ? "Space to toggle · Ctrl+Enter to finish"
              : options.length > 0
                ? "↑↓ to navigate · Enter to confirm"
                : "Type and press Enter to send"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {currentStep > 0 && (
              <button
                onClick={() => {
                  setCurrentStep((prev) => prev - 1);
                  setAnswers((prev) => prev.slice(0, -1));
                  resetStep();
                }}
                style={{
                  padding: "0 14px",
                  borderRadius: 3,
                  background: "transparent",
                  color: "var(--text-weak)",
                  border: "1px solid #242428",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "80px",
                }}
              >
                Back
              </button>
            )}
            {(step.multiSelect || currentStep === steps.length - 1) && (
              <button
                onClick={() => !isNextDisabled && handleNext()}
                disabled={isNextDisabled}
                style={{
                  padding: "0 14px",
                  borderRadius: 3,
                  background: "transparent",
                  color: isNextDisabled ? "var(--text-weaker)" : workspaceColor,
                  border: `1px solid ${isNextDisabled ? "var(--border-weaker-base)" : workspaceColor}`,
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: isNextDisabled ? "not-allowed" : "pointer",
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "80px",
                  opacity: isNextDisabled ? 0.5 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {currentStep === steps.length - 1 ? "Finish" : "Confirm"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
