/**
 * File download functionality for Swiss Ephemeris source files.
 * Ported from Python build_tool/download.py
 */

import { fs, path, console } from "./runtime.ts";
import { SOURCE_FILES, SWISSEPH_BASE_URL } from "./config.ts";

/**
 * Downloads Swiss Ephemeris source files from the GitHub repository.
 *
 * @param destDir - Destination directory for downloaded files
 */
export async function downloadFiles(destDir: string): Promise<void> {
    // Create destination directory if it doesn't exist
    await fs.mkdir(destDir, true);

    console.log(`Downloading Swiss Ephemeris source files to ${destDir}...`);

    for (const fileName of SOURCE_FILES) {
        const url = `${SWISSEPH_BASE_URL}/${fileName}`;
        const destPath = path.join(destDir, fileName);

        try {
            console.log(`Downloading ${fileName}...`);

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(
                    `HTTP error! status: ${response.status} ${response.statusText}`
                );
            }

            const content = await response.text();
            await fs.writeFile(destPath, content);

            console.log(`✅ Saved ${fileName} to ${destPath}`);
        } catch (error) {
            console.error(
                `❌ Failed to download ${fileName}: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    // Create .gitignore file in the destination directory to ignore all downloaded files
    const gitignorePath = path.join(destDir, ".gitignore");
    await fs.writeFile(gitignorePath, "*\n");

    console.log("Download complete!");
}
