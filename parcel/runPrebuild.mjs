import fs from 'fs/promises';

async function runPrebuild() {
	try {
		try {
			await fs.access('./dist');
			console.log('Removing existing dist folder...');
			await fs.rm('./dist', { recursive: true, force: true });
			console.log('dist folder removed successfully.');
		} catch (error) {
			console.log('No existing dist folder found.');
		}

		try {
			await fs.access('./.parcel-cache');
			console.log('Removing existing .parcel-cache folder...');
			await fs.rm('./.parcel-cache', { recursive: true, force: true });
			console.log('.parcel-cache folder removed successfully.');
		} catch (error) {
			console.log('No existing .parcel-cache folder found.');
		}
	} catch (error) {
		console.error('Error during prebuild:', error);
		process.exit(1);
	}
}

runPrebuild();