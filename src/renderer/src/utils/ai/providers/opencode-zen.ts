import { registerProvider } from "./registry";
import { streamCompletion } from "../opencode-zen";

registerProvider({
  id: "opencode-zen",
  streamCompletion: (messages, config, tools, signal) => {
    return streamCompletion(messages, config, tools, signal);
  },
});
