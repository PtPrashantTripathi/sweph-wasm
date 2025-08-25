<div align="center">
  <h3><em>Swiss Ephemeris WebAssembly</em></h3>

  <p><strong>A comprehensive TypeScript/JavaScript wrapper for the Swiss Ephemeris astronomical calculation library compiled to WebAssembly. This library provides high-precision calculations for planetary positions, house systems, eclipses, and various astronomical phenomena.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/sweph-wasm"><img src="https://img.shields.io/npm/v/sweph-wasm.svg" alt="NPM Version"/></a>
    <a href="https://github.com/ptprashanttripathi/sweph-wasm/actions"><img src="https://img.shields.io/github/actions/workflow/status/ptprashanttripathi/sweph-wasm/npm-publish.yml?branch=main" alt="Build Status"/></a>
    <a href="https://github.com/ptprashanttripathi/sweph-wasm/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/sweph-wasm.svg" alt="MIT License"/></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript Ready"/></a>
    <a href="https://github.com/ptprashanttripathi/sweph-wasm/blob/main/docs"><img src="https://img.shields.io/badge/docs-available-brightgreen.svg" alt="Documentation"/></a>
  </p>
</div>

## Features

- **Planetary Calculations**: Calculate positions of planets, moon, sun, and
  asteroids
- **House Systems**: Support for 25+ house systems including Placidus, Koch,
  Equal House, etc.
- **Eclipse Calculations**: Solar and lunar eclipses with detailed timing and
  visibility
- **Coordinate Transformations**: Convert between different coordinate systems
- **Fixed Stars**: Calculate positions and magnitudes of fixed stars
- **Heliacal Events**: Rising and setting calculations for celestial objects
- **High Precision**: Based on the renowned Swiss Ephemeris library
- **WebAssembly Performance**: Fast calculations in the browser or Node.js

## Installation

```bash
npm install sweph-wasm
```

## Quick Start

```typescript
import SwissEPH from "sweph-wasm";

// Initialize the library
const swe = await SwissEPH.init();

// Set ephemeris files path (optional, downloads from CDN by default)
await swe.swe_set_ephe_path();

// Calculate planetary positions
const julianDay = swe.swe_julday(2024, 1, 1, 12.0, 1); // Jan 1, 2024, noon
const sunPosition = swe.swe_calc_ut(julianDay, 0, 0); // Sun position

console.log(`Sun longitude: ${sunPosition[0]}°`);
console.log(`Sun latitude: ${sunPosition[1]}°`);
console.log(`Sun distance: ${sunPosition[2]} AU`);

// Calculate houses
const houses = swe.swe_houses(julianDay, 40.7128, -74.006, "P"); // New York, Placidus
console.log("House cusps:", houses.cusps);
console.log("Ascendant:", houses.ascmc[0]);
```

## Core Methods

### Initialization

#### `SwissEPH.init(): Promise<SwissEPH>`

Initializes the Swiss Ephemeris WebAssembly module.

#### `swe_set_ephe_path(epheUrl?, fileNames?): Promise<void>`

Downloads and sets up ephemeris files.

- `epheUrl`: URL to ephemeris files (default: Swiss Ephemeris CDN)
- `fileNames`: Array of specific files to download

### Planetary Calculations

#### `swe_calc_ut(tjd_ut, ipl, iflag): CelestialCoordinatesAdvance`

Calculate planetary positions in Universal Time.

- `tjd_ut`: Julian Day in Universal Time
- `ipl`: Planet ID (0=Sun, 1=Moon, 2=Mercury, etc.)
- `iflag`: Calculation flags

#### `swe_calc(tjd_et, ipl, iflag): CelestialCoordinatesAdvance`

Calculate planetary positions in Ephemeris Time.

### House Systems

#### `swe_houses(tjd_ut, geolat, geolon, hsys): Houses`

Calculate house cusps and angles.

- `tjd_ut`: Julian Day UT
- `geolat`: Geographic latitude in degrees
- `geolon`: Geographic longitude in degrees
- `hsys`: House system ('P'=Placidus, 'K'=Koch, 'E'=Equal, etc.)

Supported house systems:

- **A**: Equal (Asc)
- **B**: Alcabitus
- **C**: Campanus
- **D**: Equal (MC)
- **E**: Equal
- **F**: Carter poli-equatorial
- **G**: Gauquelin sectors (36)
- **H**: Azimuthal/Horizontal
- **I**: Sunshine
- **K**: Koch
- **L**: Pullen SD
- **M**: Morinus
- **N**: Equal/1=Aries
- **O**: Porphyrius
- **P**: Placidus
- **Q**: Pullen SR
- **R**: Regiomontanus
- **S**: Sripati
- **T**: Polich/Page
- **U**: Krusinski-Pisa-Goelzer
- **V**: Equal/Vehlow
- **W**: Equal/Whole Sign
- **X**: Axial rotation system/Meridian houses
- **Y**: APC houses

### Date/Time Utilities

#### `swe_julday(year, month, day, hour, gregflag): number`

Convert calendar date to Julian Day.

#### `swe_revjul(tjd, gregflag): DateTimeObject`

Convert Julian Day to calendar date.

#### `swe_utc_to_jd(iyear, imonth, iday, ihour, imin, dsec, gregflag): [et, ut]`

Convert UTC time to Julian Day.

### Eclipse Calculations

#### `swe_sol_eclipse_when_loc(tjd_start, ifl, geopos, backwards): EclipseData`

Calculate local solar eclipse times.

#### `swe_lun_eclipse_when_loc(tjd_start, ifl, geopos, backwards): EclipseData`

Calculate local lunar eclipse times.

### Fixed Stars

#### `swe_fixstar_ut(star, tjd_ut, iflag): FixstarResult`

Calculate fixed star positions.

#### `swe_fixstar_mag(star): FixstarMagnitude`

Get fixed star magnitude.

## Planet Constants

```typescript
const PLANETS = {
    SUN: 0,
    MOON: 1,
    MERCURY: 2,
    VENUS: 3,
    MARS: 4,
    JUPITER: 5,
    SATURN: 6,
    URANUS: 7,
    NEPTUNE: 8,
    PLUTO: 9,
    MEAN_NODE: 10,
    TRUE_NODE: 11,
    MEAN_APOG: 12,
    OSCU_APOG: 13,
    EARTH: 14,
    CHIRON: 15,
    PHOLUS: 16,
    CERES: 17,
    PALLAS: 18,
    JUNO: 19,
    VESTA: 20,
};
```

## Calculation Flags

Common calculation flags that can be combined:

- `SEFLG_JPLEPH`: Use JPL ephemeris
- `SEFLG_SWIEPH`: Use Swiss Ephemeris (default)
- `SEFLG_MOSEPH`: Use Moshier ephemeris
- `SEFLG_HELCTR`: Heliocentric positions
- `SEFLG_TRUEPOS`: True positions (not apparent)
- `SEFLG_J2000`: J2000 coordinates
- `SEFLG_NONUT`: No nutation
- `SEFLG_SPEED`: Calculate speeds
- `SEFLG_NOGDEFL`: No gravitational deflection
- `SEFLG_NOABERR`: No aberration
- `SEFLG_ASTROMETRIC`: Astrometric positions
- `SEFLG_EQUATORIAL`: Equatorial coordinates
- `SEFLG_XYZ`: Cartesian coordinates
- `SEFLG_RADIANS`: Return values in radians
- `SEFLG_BARYCTR`: Barycentric positions
- `SEFLG_TOPOCTR`: Topocentric positions
- `SEFLG_ORBEL_AA`: Osculating orbital elements
- `SEFLG_TROPICAL`: Tropical zodiac (default)
- `SEFLG_SIDEREAL`: Sidereal zodiac
- `SEFLG_ICRS`: ICRS reference system

## Advanced Features

### Coordinate Transformations

```typescript
// Convert ecliptic to equatorial coordinates
const equatorialCoords = swe.swe_cotrans(eclipticCoords, obliquity);

// Convert horizontal to ecliptic coordinates
const eclipticCoords = swe.swe_azalt_rev(tjd_ut, calc_flag, geopos, [
    azimuth,
    altitude,
]);
```

### Atmospheric Refraction

```typescript
// Calculate atmospheric refraction
const refraction = swe.swe_refrac(altitude, pressure, temperature, calc_flag);

// Extended refraction calculation
const refractionData = swe.swe_refrac_extended(
    altitude,
    geo_altitude,
    pressure,
    temperature,
    lapse_rate,
    calc_flag
);
```

### Heliacal Events

```typescript
// Calculate heliacal rising/setting
const heliacalEvent = swe.swe_heliacal_ut(
    tjd_ut,
    geographic_pos,
    atmospheric_conditions,
    observer_conditions,
    object_name,
    event_type,
    heliacal_flag
);
```

## Error Handling

The library throws `SWEerror` exceptions for calculation errors:

```typescript
try {
    const result = swe.swe_calc_ut(julianDay, planetId, flags);
} catch (error) {
    if (error instanceof SWEerror) {
        console.error(
            "Swiss Ephemeris error:",
            error.message,
            "Code:",
            error.code
        );
    }
}
```

## Type Definitions

The library includes comprehensive TypeScript definitions:

- `CelestialCoordinates2D`: [longitude, latitude]
- `CelestialCoordinates3D`: [longitude, latitude, distance]
- `CelestialCoordinatesAdvance`: [lon, lat, dist, lonSpeed, latSpeed, distSpeed]
- `Houses<N>`: House cusps and angles
- `DateTimeObject`: Year, month, day, hour, minute, second
- `EclipseData`: Eclipse timing and characteristics
- `FixstarResult`: Fixed star name and coordinates

## Browser Compatibility

- Modern browsers with WebAssembly support
- Node.js 14+ with WebAssembly support
- TypeScript 4.0+

## Performance Tips

1. **Reuse instances**: Initialize SwissEPH once and reuse
2. **Cache ephemeris files**: Files are cached in browser memory
3. **Batch calculations**: Calculate multiple planets in sequence
4. **Use appropriate flags**: Only request needed precision/features
5. **Close when done**: Call `swe_close()` to free resources

## Examples

### Birth Chart Calculation

```typescript
const swe = await SwissEPH.init();
await swe.swe_set_ephe_path();

const birthDate = { year: 1990, month: 6, day: 15, hour: 14.5 };
const birthPlace = { lat: 40.7128, lon: -74.006 }; // New York

const jd = swe.swe_julday(
    birthDate.year,
    birthDate.month,
    birthDate.day,
    birthDate.hour,
    1
);

// Calculate all planets
const planets = [];
for (let i = 0; i <= 9; i++) {
    const position = swe.swe_calc_ut(jd, i, 0);
    planets.push({
        id: i,
        longitude: position[0],
        latitude: position[1],
        distance: position[2],
    });
}

// Calculate houses
const houses = swe.swe_houses(jd, birthPlace.lat, birthPlace.lon, "P");

console.log("Planets:", planets);
console.log("House cusps:", houses.cusps);
console.log("Ascendant:", houses.ascmc[0]);
```

### Eclipse Calculation

```typescript
const swe = await SwissEPH.init();

const startDate = swe.swe_julday(2024, 1, 1, 0, 1);
const location = [0, 0, 0]; // Greenwich

// Find next solar eclipse
const eclipse = swe.swe_sol_eclipse_when_loc(startDate, 0, location, false);

console.log(
    "Eclipse maximum:",
    new Date((eclipse.eclipseContactTimes[0] - 2440587.5) * 86400000)
);
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

## License

This project is licensed under the same terms as the Swiss Ephemeris library.
Please refer to the Swiss Ephemeris documentation for licensing details.

## Credits

- Swiss Ephemeris by Astrodienst AG
- WebAssembly compilation and TypeScript wrapper
- Community contributors

## Support

For issues and questions:

- GitHub Issues for bug reports
- Documentation for API reference
- Swiss Ephemeris official documentation for calculation details

### Development Setup

```bash
# Clone repository
git clone https://github.com/ptprashanttripathi/sweph-wasm.git
cd sweph-wasm

# Install dependencies
npm install

# Build TypeScript
npm run build

# Build WASM test module
npm run build:wasm

# Run tests
npm test

# Generate documentation
npm run build:docs
```

## 📄 License

This project is [MIT](LICENSE) licensed.

## 🙏 Acknowledgments

- **Emscripten Team** - For making WebAssembly accessible
- **TypeScript Team** - For excellent type system support
- **WebAssembly Community** - For pushing the boundaries of web performance

---

<div align="center">
<p>Made with ❤️ by <a href="https://github.com/ptprashanttripathi">Pt. Prashant Tripathi</a></p>
<p>⭐ Star this repo if you find it helpful!</p>
</div>
