import { Configuration } from "electron-builder";

const config: Configuration = {
  appId: "com.codeclub.app",
  productName: "Code Club",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: ["out/**/*"],
  extraResources: [
    {
      from: "resources",
      to: "resources",
      filter: ["**/*"],
    },
  ],
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.developer-tools",
    hardenedRuntime: true,
    artifactName: "codeclub-${os}-${arch}.${ext}",
  },
  win: {
    target: ["nsis", "zip"],
    artifactName: "codeclub-${os}-${arch}.${ext}",
  },
  nsis: {
    oneClick: true,
    perMachine: false,
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Development",
    artifactName: "codeclub-${os}-${arch}.${ext}",
    executableName: "codeclub",
  },
  protocols: {
    name: "Code Club",
    schemes: ["codeclub"],
  },
};

export default config;
