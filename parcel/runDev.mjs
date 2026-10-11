import { spawn } from "node:child_process";

const debugging = process.argv.includes("--debug");
process.env.DEBUG = debugging ? "true" : "false";
console.log(`Starting Parcel bundler${debugging ? " with debugging enabled" : ""}...`);

const parcel = spawn("parcel", ["--no-cache", "--config", "./parcel/.parcel.dev", ...process.argv.slice(2).filter(argument => argument !== "--debug")], {
	stdio: "inherit",
	shell: true
});

parcel.on("exit", code => {
	process.exitCode = code ?? 0;
});

parcel.on("error", error => {
	console.error(error);
	process.exitCode = 1;
});