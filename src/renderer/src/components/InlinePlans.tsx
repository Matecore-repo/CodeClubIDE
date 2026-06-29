import type { AgentPlan } from "../hooks/useChat";

export function InlinePlans({ plans }: { plans: AgentPlan[] }) {
  if (plans.length === 0) return null;

  return (
    <div style={{ padding: "4px 0 8px" }}>
      {plans.map((plan) => {
        const completed = plan.steps.filter((step) => step.status === "completed").length;
        return (
          <details
            key={plan.scope}
            open={plan.scope === "main"}
            style={{
              borderLeft: "2px solid var(--border-weak-base)",
              padding: "3px 0 3px 10px",
              marginBottom: 5,
              fontSize: "var(--font-size-small)",
            }}
          >
            <summary style={{ cursor: "pointer", color: "var(--text-base)", fontWeight: 500 }}>
              {plan.scope === "main" ? "Plan" : "Subagente"} · {plan.title}
              <span style={{ color: "var(--text-weaker)", fontWeight: 400 }}>
                {" "}
                · {completed}/{plan.steps.length}
              </span>
            </summary>
            <div style={{ padding: "5px 0 1px 8px" }}>
              {plan.steps.map((step, index) => (
                <div
                  key={`${step.text}-${index}`}
                  style={{
                    display: "flex",
                    gap: 7,
                    padding: "2px 0",
                    color: step.status === "completed" ? "var(--text-weaker)" : "var(--text-weak)",
                  }}
                >
                  <span style={{ width: 12, flexShrink: 0 }}>
                    {step.status === "completed" ? "✓" : step.status === "in_progress" ? "●" : "○"}
                  </span>
                  <span
                    style={{
                      textDecoration: step.status === "completed" ? "line-through" : "none",
                    }}
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
