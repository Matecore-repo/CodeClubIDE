import React from "react";
import { type UserSettings } from "../../utils/userSettings";

export interface PanelManagerProps {
  filePath?: string | null;
  showChat: boolean;
  showTerminal: boolean;
  showGraph: boolean;
  showReview?: boolean;
  showPlan?: boolean;
  setShowPlan?: (v: boolean) => void;
  debugProgram: string | null;
  splitRatio?: number;
  handleMainResize?: (e: React.MouseEvent) => void;
  onBack?: () => void;
  onFileSelect?: (path: string) => void;
  workspacePath?: string | null;
  sandbox: boolean;
  activeColor?: string;
  setShowTerminal: (v: boolean) => void;
  setShowGraph: (v: boolean) => void;
  setShowChat: (v: boolean) => void;
  setShowReview?: (v: boolean) => void;
  setDebugProgram: (v: string | null) => void;
  displayMessages: any[];
  loading: boolean;
  compacting: boolean;
  error: string | null;
  plans: any[];
  todos: any[];
  planMode: boolean;
  configModel?: string;
  fetchedModels?: any[] | null;
  regenerate: (id: string) => void;
  restoreCheckpoint?: (id: string) => Promise<void>;
  endRef: React.RefObject<HTMLDivElement | null>;
  chatInputControls?: React.ReactNode;
  chatSessionTabs?: React.ReactNode;
  chatSessions?: { id: string; title: string; displayMessages: any[] }[];
  activeChatSessionId?: string;
  chatSubTab?: "chat" | "plan";
  onCreateChatSession?: () => string | undefined;
  onDeleteChatSession?: (id: string) => void;
  onSwitchChatSession?: (id: string) => void;
  studioMode?: boolean;
  designMode?: boolean;
  designToolbarVisible?: boolean;
  userSettings?: UserSettings;
  layoutMode?: "single" | "split2" | "split4";
  terminalBottom?: boolean;
  setTerminalBottom?: (v: boolean) => void;
}

export interface LauncherItem {
  id: string;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}
