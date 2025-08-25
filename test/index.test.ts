/**
 * @file Comprehensive test suite for sweph-wasm library.
 *
 *   This test suite validates all functionality of the sweph-wasm library
 *   including:
 *
 *   - Memory management operations
 *   - Type-safe pointer operations
 *   - Array manipulation
 *   - String handling
 *   - Error handling and validation
 *   - Performance characteristics
 *
 *   Tests are organized into logical groups with descriptive names and
 *   comprehensive coverage of both happy path and error conditions.
 * @author Pt. Prashant Tripathi
 * @since 1.0.0
 */
import { beforeAll, describe, expect, it } from "vitest";

import SwissEPH from "../src";

describe("Ephemeris Path Configuration", () => {
    let swe: SwissEPH;

    // A clear, descriptive name for the base URL where files are hosted.
    const ephemerisBaseUrl = "https://ptprashanttripathi.github.io/sweph-wasm/ephe/";

    // Describes exactly what the array contains: the specific files needed for the test.
    const requiredEphemerisFiles = [
        "seas_18.se1",
        "sepl_18.se1",
        "semo_18.se1",
    ];

    beforeAll(async () => {
        // Initialize the module once before all tests in this suite
        swe = await SwissEPH.init();
    });

    it("should successfully load ephemeris files from a remote URL", async () => {
        await expect(
            swe.swe_set_ephe_path(ephemerisBaseUrl, requiredEphemerisFiles)
        ).resolves.not.toThrow();
    });
});
