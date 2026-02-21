# Glass Thermostat Card

A beautiful liquid glass style thermostat card for Home Assistant with smooth animations and touch-friendly controls.

## Features

- Liquid glass aesthetic with dynamic backgrounds that respond to HVAC state
- **Refractive Glass Effect**: Optional integration with the [Liquid Glass](https://github.com/FezVrasta/liquid-glass) HACS addon for enhanced refraction and squircle corners
- Touch-friendly vertical slider for temperature adjustment
- Expandable card with collapsible slider
- Secondary entity display (power consumption, humidity, etc.)
- Localized status text
- Smooth animations throughout

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the three dots menu and select "Custom repositories"
3. Add this repository URL and select "Lovelace" as the category
4. Search for "Glass Thermostat Card" and install
5. **Optional**: For the enhanced refraction effect, also install [Liquid Glass](https://github.com/FezVrasta/liquid-glass)
6. Restart Home Assistant

### Manual

1. Download `glass-thermostat-card.js` from the [latest release](../../releases/latest)
2. Copy to `config/www/glass-thermostat-card.js`
3. Add resource in Settings > Dashboards > Resources:
   ```
   /local/glass-thermostat-card.js
   ```

## Usage

### Visual Editor

The card includes a full visual editor for easy configuration.

### YAML Configuration

```yaml
type: custom:glass-thermostat-card
entity: climate.living_room
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **required** | Climate entity ID |
| `secondary_entity` | string | `null` | Optional secondary sensor (power, humidity, etc.) |
| `secondary_label` | string | `null` | Custom label for secondary entity |

### Secondary Entity Example

Display power consumption or humidity alongside the thermostat:

```yaml
type: custom:glass-thermostat-card
entity: climate.heating
secondary_entity: sensor.heating_power
secondary_label: Power
```

## Dynamic Background Colors

The card automatically adjusts its background gradient based on HVAC state:
- **Heating active**: Red/orange gradient
- **Cooling active**: Blue gradient
- **Heat mode (idle)**: Warm orange gradient
- **Cool mode (idle)**: Light blue gradient
- **Off**: Gray gradient

## License

MIT License - see [LICENSE](LICENSE) for details.

> [!IMPORTANT]
> This card relies on advanced SVG filters and CSS features for its glass effects. For best results, use a **Chromium-based browser** (Chrome, Edge, Brave, etc.). Some visual features may be missing or look different in Firefox or Safari.
