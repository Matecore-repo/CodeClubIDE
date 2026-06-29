import { registerProvider } from "./registry";
import { streamCompletion } from "../opencode-go";

registerProvider({
  id: "opencode-go",
  streamCompletion: (messages, config, tools, signal) => {
    return streamCompletion(messages, config, tools, signal);
  },
});
