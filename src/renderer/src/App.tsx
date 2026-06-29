import { useState, useEffect, useCallback } from "react";
import { Layout } from "./components/Layout";
import { Chat } from "./components/Chat";
import { ApiSettings } from "./components/ApiSettings";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { AIConfig } from "./utils/ai";
import {
  getUserSettings,
  saveUserSettings,
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "./utils/userSettings";
import { useSwarmWorker } from "./hooks/useSwarmWorker";

function App(): React.ReactElement {
  const [version, setVersion] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>("general");
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const { agents, killAgent, killAll, clearAgents } = useSwarmWorker(aiConfig);

  useEffect(() => {
    window.api
      .getVersion()
      .then(setVersion)
      .catch(() => {});
    window.api.storeGet("ai", "config").then((val) => {
      if (val) setAiConfig(val as AIConfig);
      else
        setAiConfig({
          apiKey: "",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "openai/gpt-4o-mini",
        });
    });
    getUserSettings()
      .then(setUserSettings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const openSettings = (e: Event) => {
      if (e instanceof CustomEvent && e.detail) {
        setSettingsTab(e.detail);
      } else {
        setSettingsTab("general");
      }
      setShowSettings(true);
    };
    window.addEventListener("codeclub:open-settings", openSettings);
    return () => window.removeEventListener("codeclub:open-settings", openSettings);
  }, []);

  const handleSaveConfig = useCallback((config: AIConfig) => {
    setAiConfig(config);
    setShowSettings(false);
    window.api.storeSet("ai", "config", config);
  }, []);

  const handleConfigChange = useCallback((config: AIConfig) => {
    setAiConfig(config);
    window.api.storeSet("ai", "config", config);
  }, []);

  const handleSaveUserSettings = useCallback((settings: UserSettings) => {
    setUserSettings(settings);
    saveUserSettings(settings).catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <Layout
        version={version}
        onSettingsClick={() => setShowSettings(true)}
        userSettings={userSettings}
        swarm={{ agents, killAgent, killAll, clearAgents }}
      >
        <Chat
          config={aiConfig}
          onConfigure={() => setShowSettings(true)}
          onConfigChange={handleConfigChange}
          userSettings={userSettings}
        />
        {showSettings && (
          <ApiSettings
            config={aiConfig}
            version={version}
            onSave={handleSaveConfig}
            onClose={() => setShowSettings(false)}
            userSettings={userSettings}
            onSaveUserSettings={handleSaveUserSettings}
            initialTab={settingsTab}
          />
        )}
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
