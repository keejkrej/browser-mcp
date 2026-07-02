#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const appDir = path.join(__dirname, "..");

function findElectron() {
  try {
    return require.resolve("electron");
  } catch {
    // continue
  }
  const globalRoots = [
    path.join(process.env.HOME || "", ".npm-global", "lib", "node_modules"),
    path.join(process.env.HOME || "", ".nvm"),
    "/usr/local/lib/node_modules",
    "/opt/homebrew/lib/node_modules",
  ];
  for (const root of globalRoots) {
    try {
      const candidate = require.resolve("electron", { paths: [root] });
      if (candidate) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

function launch(electronBin, args) {
  const child = spawn(electronBin, args, {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env },
  });
  child.on("exit", (code) => process.exit(code || 0));
  child.on("error", (err) => {
    console.error("Failed to launch Electron:", err.message);
    process.exit(1);
  });
}

const electronModulePath = findElectron();

if (electronModulePath) {
  const electronBin = require(electronModulePath);
  if (typeof electronBin === "string") {
    launch(electronBin, [appDir]);
  } else {
    launch("npx", ["electron", appDir]);
  }
} else {
  console.error("Electron not found. Install it with: npm install -g electron");
  console.error("Then run: browser-mcp");
  process.exit(1);
}
