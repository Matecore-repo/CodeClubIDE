import { registerProvider } from "./registry";
import { streamCompletion } from "../openai";

const NON_CHAT_MODELS = [
  "audio",
  "tts",
  "transcribe",
  "whisper",
  "realtime",
  "image",
  "dall-e",
  "sora",
  "embedding",
  "moderation",
  "search",
  "computer-use",
];

function isOpenAITextToolModel(id: string): boolean {
  const model = id.toLowerCase();
  if (NON_CHAT_MODELS.some((fragment) => model.includes(fragment))) return false;
  return /^(gpt-|o[1-9](?:-|$)|codex)/.test(model);
}

registerProvider({
  id: "openai",
  streamCompletion,
  filterModels: (models) =>
    models.filter((model) => model.tool_call !== false && isOpenAITextToolModel(model.id)),
  supportsReasoning: (model) => model?.reasoning === true,
});
