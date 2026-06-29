import { ElectronAPI } from "../preload/types";

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
