#!/usr/bin/env node
const process = require("process");
const path = require("path");
const { spawn, exec } = require("child_process");
const { readFile } = require("fs");

const REQUIRED_RELEASE_BRANCH = "main";
const ACCEPTABLE_VERSION_BUMP_OPTIONS = ["major", "minor", "patch"];

async function main() {
  const dir = path.resolve(__dirname, "../");

  // const pwd = await run(dir, "pwd");
  const branchName = await run(dir, "git", "branch", "--show-current");

  if (branchName !== REQUIRED_RELEASE_BRANCH) {
    throw new Error(
      `Releases can only be made from the ${REQUIRED_RELEASE_BRANCH} branch.`
    );
  }

  const versionBump = process.argv.length > 2 ? process.argv[2] : "undefined";

  if (!ACCEPTABLE_VERSION_BUMP_OPTIONS.includes(versionBump.toLowerCase())) {
    throw new Error(
      `${versionBump} is not a valid semver version to bump.  Valid options are: ${ACCEPTABLE_VERSION_BUMP_OPTIONS.join(
        ", "
      )}`
    );
  }

  // npm run version ${versionBump}
  // lerna publish from-package
}

function run(cwd, command, ...args) {
  console.log("Executing:", command, args.join(" "));
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const outBuffer = [];
    const errBuffer = [];

    proc.stdout.on("data", data => {
      return outBuffer.push(data);
    });

    proc.stderr.on("data", data => {
      return errBuffer.push(data);
    });

    proc.on("error", () => {
      reject(new Error(`command failed: ${command}`));
    });

    proc.on("exit", code => {
      if (code === 0) {
        const stdout = Buffer.concat(outBuffer).toString("utf8").trim();
        resolve(stdout);
      } else {
        const stderr = Buffer.concat(errBuffer).toString("utf8").trim();
        if (stderr) {
          console.log(`command failed with code ${code}`);
          console.log(stderr);
        }
        reject(new ExitError(code));
      }
    });
  });
}

async function readJson(file) {
  const data = await new Promise((resolve, reject) =>
    readFile(file, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  );
  return JSON.parse(data);
}

class ExitError extends Error {
  constructor(code) {
    super(`command failed with code ${code}`);
    this.code = code;
  }
}

main().catch(e => {
  process.exitCode = 1;
  console.log(e.message || e);
});
