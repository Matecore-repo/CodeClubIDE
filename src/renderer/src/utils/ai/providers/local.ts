import { registerProvider } from "./registry";
import { streamCompletion } from "../openai";

registerProvider({
  id: "ollama",
  streamCompletion,
  supportsReasoning: () => false,
});

registerProvider({
  id: "custom",
  streamCompletion,
  supportsReasoning: () => false,
});
