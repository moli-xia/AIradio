import { spawn } from "node:child_process";

const restartDelayMs = 1500;
let stopping = false;
let child = null;

function startApi() {
  child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) {
      process.exit(code ?? 0);
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev:api] backend exited with ${reason}; restarting in ${restartDelayMs}ms...`);
    setTimeout(startApi, restartDelayMs);
  });
}

function stop(signal) {
  stopping = true;
  if (child) {
    child.kill(signal);
    return;
  }
  process.exit(0);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

startApi();
