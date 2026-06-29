import bytenode from "bytenode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainProcessFile = path.resolve(__dirname, "../out/main/index.cjs");
const outputFile = path.resolve(__dirname, "../out/main/index.jsc");

async function compile() {
  if (fs.existsSync(mainProcessFile)) {
    console.log(`Compiling ${mainProcessFile} to bytecode...`);
    // Compiling natively in current engine (Electron)
    await bytenode.compileFile({
      filename: mainProcessFile,
      output: outputFile,
    });

    // Replace the original file with a loader
    fs.writeFileSync(mainProcessFile, `require('bytenode');\nrequire('./index.jsc');\n`);
    console.log("Done compiling to bytecode.");
    process.exit(0);
  } else {
    console.error(`File not found: ${mainProcessFile}`);
    process.exit(1);
  }
}

compile().catch((e) => {
  console.error(e);
  process.exit(1);
});
