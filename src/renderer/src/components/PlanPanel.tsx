import React, { useMemo } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { AgentPlan, AgentTodo } from "../hooks/useAgentLoop";

interface PlanPanelProps {
  plans: AgentPlan[];
  todos: AgentTodo[];
}

export function PlanPanel({ plans, todos }: PlanPanelProps) {
  const markdownContent = useMemo(() => {
    let md = "# Agent Strategy & Execution\n\n";

    if (plans.length > 0) {
      const activePlan = plans[0];
      md += `## 🗺️ Plan: ${activePlan.title || "Main Strategy"}\n\n`;
      activePlan.steps.forEach((step) => {
        if (step.status === "completed") {
          md += `- [x] ~${step.text}~\n`;
        } else if (step.status === "in_progress") {
          md += `- [ ] **${step.text}** (In Progress)\n`;
        } else {
          md += `- [ ] ${step.text}\n`;
        }
      });
      md += "\n---\n\n";
    }

    if (todos.length > 0) {
      const activeTodo = todos[0];
      md += `## ⚡ To-Do: ${activeTodo.title || "Current Tasks"}\n\n`;
      activeTodo.tasks.forEach((task) => {
        if (task.status === "completed") {
          md += `- [x] ~${task.text}~\n`;
        } else if (task.status === "in_progress") {
          md += `- [ ] **${task.text}** (In Progress)\n`;
        } else {
          md += `- [ ] ${task.text}\n`;
        }
      });
    }

    if (plans.length === 0 && todos.length === 0) {
      md +=
        "*No active plans or to-do tasks at the moment.*\n\n*The AI will update this automatically when you request a complex task.*";
    }

    return md;
  }, [plans, todos]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <MarkdownRenderer content={markdownContent} />
        </div>
      </div>
    </div>
  );
}
