import { registerProvider } from "./registry";
import { streamCompletion } from "../openrouter";

registerProvider({
  id: "openrouter",
  streamCompletion,
});
