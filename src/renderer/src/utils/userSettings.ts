export interface MCPServerConfig {
  name: string;
  type?: "stdio" | "sse"; // Optional for backwards compatibility, defaults to stdio if missing
  // For stdio:
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For sse:
  url?: string;
}

export interface UserSettings {
  username: string;
  color: string;
  caretShape: "bar" | "block";
  mcpServers?: MCPServerConfig[];
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  username: "You",
  color: "#7c5cbf",
  caretShape: "bar",
  mcpServers: [],
};

export const USER_COLOR_OPTIONS = [
  "#7c5cbf", // Dusty Purple
  "#e07b5a", // Terracotta
  "#4a9e8e", // Sage Teal
  "#c2718a", // Mauve Rose
  "#5b8fc2", // Muted Blue
  "#c49b4a", // Mustard Gold
  "#6a9e6a", // Forest Sage
  "#9b6b9e", // Smoky Lavender
];

export async function getUserSettings(): Promise<UserSettings> {
  let defaultUsername = DEFAULT_USER_SETTINGS.username;
  try {
    const devName = await window.api.getDeviceName();
    if (devName) {
      defaultUsername = devName;
    }
  } catch (e) {
    console.error("Failed to get device name:", e);
  }

  try {
    const val = await window.api.storeGet("ui", "userSettings");
    if (val && typeof val === "object") {
      const settings = val as Partial<UserSettings>;
      return {
        username:
          settings.username && settings.username !== "You" ? settings.username : defaultUsername,
        color: settings.color || DEFAULT_USER_SETTINGS.color,
        caretShape: settings.caretShape || DEFAULT_USER_SETTINGS.caretShape,
        mcpServers: settings.mcpServers || [],
      };
    }
  } catch (err) {
    console.error("Error reading user settings:", err);
  }
  return {
    ...DEFAULT_USER_SETTINGS,
    username: defaultUsername,
  };
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  try {
    await window.api.storeSet("ui", "userSettings", settings);
  } catch (err) {
    console.error("Error writing user settings:", err);
  }
}
