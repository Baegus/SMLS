import fs from "node:fs/promises";

try {
	for (const directory of ["dist", ".parcel-cache"]) {
		console.log(`Removing ${directory}...`);
		await fs.rm(directory, { recursive: true, force: true });
	}
} catch (error) {
	console.error("Error during prebuild:", error);
	process.exitCode = 1;
}