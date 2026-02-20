/**
 * Glass Thermostat Card - A liquid glass style thermostat card for Home Assistant
 * Features dynamic background colors, collapsible slider, and smooth animations
 */

const VERSION = '1.0.0';

class GlassThermostatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._isDragging = false;
    this._pendingTemp = null;
    this._expanded = false;
    this._rafId = null;
    this._boundOnMove = null;
    this._boundOnEnd = null;
    this._rendered = false;
  }

  static getStubConfig() {
    return { entity: '' };
  }

  static getConfigElement() {
    return document.createElement('glass-thermostat-card-editor');
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (this._isDragging) return;

    // Only re-render if relevant entity states actually changed
    const entityId = this._config.entity;
    const secondaryId = this._config.secondary_entity || this._config.power_entity;

    const entityChanged = oldHass?.states[entityId] !== hass?.states[entityId];
    const secondaryChanged = secondaryId && oldHass?.states[secondaryId] !== hass?.states[secondaryId];

    if (entityChanged || secondaryChanged || !oldHass) {
      this._render();
    }
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define an entity');
    }
    this._config = config;
  }

  getCardSize() {
    return 6;
  }

  disconnectedCallback() {
    if (this._boundOnMove) {
      document.removeEventListener('mousemove', this._boundOnMove);
      document.removeEventListener('touchmove', this._boundOnMove);
    }
    if (this._boundOnEnd) {
      document.removeEventListener('mouseup', this._boundOnEnd);
      document.removeEventListener('touchend', this._boundOnEnd);
    }
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }
  }

  _getTemperatureFromPosition(clientY) {
    const slider = this.shadowRoot.querySelector('.slider-box');
    if (!slider) return null;

    const rect = slider.getBoundingClientRect();
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const entity = this._hass.states[this._config.entity];
    const minTemp = entity?.attributes.min_temp || 5;
    const maxTemp = entity?.attributes.max_temp || 30;
    const step = entity?.attributes.target_temp_step || 0.5;

    const temp = minTemp + ratio * (maxTemp - minTemp);
    return Math.round(temp / step) * step;
  }

  _setTemperature(temperature) {
    this._hass.callService('climate', 'set_temperature', {
      entity_id: this._config.entity,
      temperature: temperature
    });
  }

  _fireMoreInfo() {
    const event = new Event('hass-more-info', {
      bubbles: true,
      composed: true
    });
    event.detail = { entityId: this._config.entity };
    this.dispatchEvent(event);
  }

  _expand() {
    if (this._expanded) return;
    this._expanded = true;
    const card = this.shadowRoot.querySelector('.card');
    if (card) card.classList.add('expanded');
  }

  _collapse() {
    if (!this._expanded) return;
    this._expanded = false;
    const card = this.shadowRoot.querySelector('.card');
    if (card) card.classList.remove('expanded');
  }

  _setupInteraction() {
    const sliderBox = this.shadowRoot.querySelector('.slider-box');
    const statusText = this.shadowRoot.querySelector('.status-text');
    const collapseBtn = this.shadowRoot.querySelector('.collapse-btn');

    // Slider box tap → expand (when collapsed)
    if (sliderBox && !sliderBox._tapBound) {
      sliderBox._tapBound = true;
      sliderBox.addEventListener('click', (e) => {
        if (!this._expanded && !this._isDragging) {
          e.stopPropagation();
          this._expand();
        }
      });
    }

    // Collapse button
    if (collapseBtn && !collapseBtn._bound) {
      collapseBtn._bound = true;
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._collapse();
      });
    }

    // Status text → more info
    if (statusText && !statusText._bound) {
      statusText._bound = true;
      statusText.addEventListener('click', (e) => {
        e.stopPropagation();
        this._fireMoreInfo();
      });
    }

    if (!sliderBox || sliderBox._dragBound) return;
    sliderBox._dragBound = true;

    let lastClientY = 0;

    const updateTemp = () => {
      this._rafId = null;
      if (!this._isDragging) return;
      this._pendingTemp = this._getTemperatureFromPosition(lastClientY);
      this._updateDisplay();
    };

    const onStart = (e) => {
      if (!this._expanded) return; // Don't drag when collapsed
      e.preventDefault();
      this._isDragging = true;
      lastClientY = e.touches ? e.touches[0].clientY : e.clientY;
      this._pendingTemp = this._getTemperatureFromPosition(lastClientY);
      this._updateDisplay();
    };

    const onMove = (e) => {
      if (!this._isDragging) return;
      e.preventDefault();
      lastClientY = e.touches ? e.touches[0].clientY : e.clientY;
      if (!this._rafId) {
        this._rafId = requestAnimationFrame(updateTemp);
      }
    };

    const onEnd = () => {
      if (!this._isDragging) return;
      this._isDragging = false;
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this._pendingTemp !== null) {
        this._setTemperature(this._pendingTemp);
        this._pendingTemp = null;
      }
    };

    this._boundOnMove = onMove;
    this._boundOnEnd = onEnd;

    sliderBox.addEventListener('mousedown', onStart);
    sliderBox.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
  }

  _updateDisplay() {
    const fill = this.shadowRoot.querySelector('.slider-fill');
    const tempDisplay = this.shadowRoot.querySelector('.target-temp');
    if (!fill || !tempDisplay) return;

    const entity = this._hass.states[this._config.entity];
    const minTemp = entity?.attributes.min_temp || 5;
    const maxTemp = entity?.attributes.max_temp || 30;
    const temp = this._pendingTemp ?? entity?.attributes.temperature ?? 20;

    const ratio = (temp - minTemp) / (maxTemp - minTemp);
    fill.style.transform = `scaleY(${ratio})`;
    tempDisplay.style.color = ratio > 0.75 ? '#3A3A3C' : 'white';

    const wholePart = Math.floor(temp);
    const decimalPart = Math.round((temp % 1) * 10);
    tempDisplay.innerHTML = `${wholePart}<span class="decimal">.${decimalPart}</span><span class="degree">⭘</span>`;
  }

  _getColors(state, hvacAction) {
    const isHeating = hvacAction === 'heating';
    const isCooling = hvacAction === 'cooling';
    const isHeatMode = state === 'heat' || state === 'heat_cool' || state === 'auto';
    const isCoolMode = state === 'cool';

    if (state === 'off') {
      return { primary: '#888888', secondary: '#666666', accent: '#aaaaaa', dark: '#444444', shadow: '#333355' };
    } else if (isCooling) {
      return { primary: '#4da6ff', secondary: '#0066cc', accent: '#66ccff', dark: '#003366', shadow: '#001a33' };
    } else if (isHeating) {
      return { primary: '#ff4d4d', secondary: '#cc0000', accent: '#ff3333', dark: '#660000', shadow: '#330000' };
    } else if (isCoolMode) {
      return { primary: '#66b3ff', secondary: '#3399ff', accent: '#99ccff', dark: '#004080', shadow: '#002244' };
    } else if (isHeatMode) {
      return { primary: '#ff9933', secondary: '#ff6600', accent: '#ffcc66', dark: '#994400', shadow: '#662200' };
    } else {
      return { primary: '#ff9933', secondary: '#ff6600', accent: '#ffcc66', dark: '#994400', shadow: '#662200' };
    }
  }

  _getBackground(colors) {
    return `url("data:image/svg+xml,%3Csvg width='100%25' height='100%25' viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='xMidYMid slice'%3E%3Crect width='1000' height='600' fill='%23020202' /%3E%3Cdefs%3E%3Cfilter id='soft-glow' x='-50%25' y='-50%25' width='200%25' height='200%25'%3E%3CfeGaussianBlur in='SourceGraphic' stdDeviation='45' /%3E%3C/filter%3E%3Cfilter id='core-blur' x='-50%25' y='-50%25' width='200%25' height='200%25'%3E%3CfeGaussianBlur in='SourceGraphic' stdDeviation='25' /%3E%3C/filter%3E%3ClinearGradient id='main-beam' x1='0%25' y1='50%25' x2='100%25' y2='50%25'%3E%3Cstop offset='0%25' stop-color='${encodeURIComponent(colors.primary)}' stop-opacity='0.9'/%3E%3Cstop offset='40%25' stop-color='${encodeURIComponent(colors.secondary)}' stop-opacity='0.6'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0'/%3E%3C/linearGradient%3E%3ClinearGradient id='cool-shadow' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='${encodeURIComponent(colors.secondary)}' stop-opacity='0.4'/%3E%3Cstop offset='60%25' stop-color='${encodeURIComponent(colors.shadow)}' stop-opacity='0.5'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg transform='translate(500, 300) rotate(-40) translate(-500, -300)'%3E%3Crect x='450' y='150' width='400' height='300' fill='url(%23cool-shadow)' filter='url(%23soft-glow)' /%3E%3Crect x='150' y='50' width='300' height='500' fill='${encodeURIComponent(colors.dark)}' opacity='0.6' filter='url(%23soft-glow)' /%3E%3Crect x='350' y='100' width='250' height='500' fill='url(%23main-beam)' filter='url(%23core-blur)' /%3E%3Crect x='200' y='-100' width='200' height='400' fill='${encodeURIComponent(colors.accent)}' opacity='0.4' filter='url(%23soft-glow)' /%3E%3C/g%3E%3CradialGradient id='vignette' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='70%25' stop-color='%23000000' stop-opacity='0'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.6'/%3E%3C/radialGradient%3E%3Crect width='100%25' height='100%25' fill='url(%23vignette)' /%3E%3C/svg%3E")`;
  }

  _getStatusText(state, hvacAction) {
    const localize = (key, fallback) => this._hass.localize(key) || fallback;

    // Get localized state name
    const modeName = localize(`component.climate.entity_component._.state.${state}`, state);

    // Get localized hvac_action
    const heatingText = localize('component.climate.entity_component._.state_attributes.hvac_action.heating', 'Heating');
    const coolingText = localize('component.climate.entity_component._.state_attributes.hvac_action.cooling', 'Cooling');
    const idleText = localize('component.climate.entity_component._.state_attributes.hvac_action.idle', 'Idle');

    if (state === 'off') {
      return modeName;
    } else if (hvacAction === 'heating') {
      return `${heatingText} to`;
    } else if (hvacAction === 'cooling') {
      return `${coolingText} to`;
    } else if (hvacAction === 'idle') {
      return `${modeName} · ${idleText}`;
    } else {
      return `${modeName} · Set to`;
    }
  }

  _render() {
    const entity = this._hass.states[this._config.entity];
    if (!entity) {
      this.shadowRoot.innerHTML = `<ha-card style="padding: 20px; color: red;">Entity not found: ${this._config.entity}</ha-card>`;
      return;
    }

    const currentTemp = entity.attributes.current_temperature ?? 0;
    const targetTemp = entity.attributes.temperature ?? 20;
    const minTemp = entity.attributes.min_temp ?? 5;
    const maxTemp = entity.attributes.max_temp ?? 30;
    const hvacAction = entity.attributes.hvac_action;
    const state = entity.state;

    // Secondary info (generic entity display) - backwards compatible with power_entity
    const secondaryEntityId = this._config.secondary_entity || this._config.power_entity;
    const secondaryEntity = secondaryEntityId ? this._hass.states[secondaryEntityId] : null;
    const secondaryValue = secondaryEntity ? parseFloat(secondaryEntity.state) : NaN;
    const secondary = isNaN(secondaryValue) ? null : {
      value: Math.round(secondaryValue),
      unit: secondaryEntity.attributes.unit_of_measurement || '',
      label: this._config.secondary_label || secondaryEntity.attributes.friendly_name || 'Value'
    };

    const targetWhole = Math.floor(targetTemp);
    const targetDecimal = Math.round((targetTemp % 1) * 10);
    const currentWhole = Math.floor(currentTemp);
    const currentDecimal = Math.round((currentTemp % 1) * 10);

    const fillRatio = (targetTemp - minTemp) / (maxTemp - minTemp);

    const colors = this._getColors(state, hvacAction);
    const background = this._getBackground(colors);
    const statusText = this._getStatusText(state, hvacAction);

    // Only do full render once, then update values
    if (!this._rendered) {
      this._renderFull(background, statusText, targetWhole, targetDecimal, fillRatio, currentWhole, currentDecimal, secondary);
      this._rendered = true;
      this._setupInteraction();
    } else {
      this._updateValues(statusText, targetWhole, targetDecimal, fillRatio, currentWhole, currentDecimal, secondary, background);
    }
  }

  _renderFull(background, statusText, targetWhole, targetDecimal, fillRatio, currentWhole, currentDecimal, secondary) {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          contain: layout style paint;
        }
        ha-card {
          width: 100%;
          height: 100%;
          background: none !important;
          border: none !important;
          box-shadow: none !important;
        }
        .card {
          width: 480px;
          height: 480px;
          background: var(--card-bg);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          border-radius: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          color: white;
          overflow: hidden;
          contain: layout style paint;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 280px;
          margin-bottom: 16px;
          position: relative;
          height: 40px;
        }

        .status-text {
          font-size: 18px;
          font-weight: 500;
          opacity: 0.9;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 16px;
          -webkit-tap-highlight-color: transparent;
          transform: translateZ(0);
          transition: background 0.15s ease;
        }

        .status-text:active {
          background: rgba(255, 255, 255, 0.25);
        }

        .collapse-btn {
          position: absolute;
          right: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          -webkit-tap-highlight-color: transparent;
          transform: translateZ(0) scale(0);
          opacity: 0;
          transition: transform 0.25s ease, opacity 0.25s ease, background 0.15s ease;
          pointer-events: none;
        }

        .card.expanded .collapse-btn {
          transform: translateZ(0) scale(1);
          opacity: 1;
          pointer-events: auto;
        }

        .collapse-btn:active {
          background: rgba(255, 255, 255, 0.35);
        }

        .slider-container {
          flex: 1;
          width: 100%;
          max-width: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .slider-wrapper {
          width: 100%;
          height: 240px;
          border-radius: 28px;
          box-shadow:
            0 5px 10px -8px rgba(0,0,0,0.7),
            0 5px 20px 10px rgba(0,0,0,0.3);
          transition: height 0.3s ease;
        }

        .card.expanded .slider-wrapper {
          height: 100%;
        }

        .slider-box {
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.3),
            inset 0 -1px 1px rgba(0, 0, 0, 0.1);
          position: relative;
          cursor: pointer;
          overflow: hidden;
          contain: layout style;
          transform: translateZ(0);
          -webkit-tap-highlight-color: transparent;
          /* Squircle mask for proper clipping */
          -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M0,28 C0,6 6,0 28,0 L72,0 C94,0 100,6 100,28 L100,72 C100,94 94,100 72,100 L28,100 C6,100 0,94 0,72 Z' fill='black'/%3E%3C/svg%3E");
          -webkit-mask-size: 100% 100%;
          -webkit-mask-repeat: no-repeat;
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M0,28 C0,6 6,0 28,0 L72,0 C94,0 100,6 100,28 L100,72 C100,94 94,100 72,100 L28,100 C6,100 0,94 0,72 Z' fill='black'/%3E%3C/svg%3E");
          mask-size: 100% 100%;
          mask-repeat: no-repeat;
        }

        .card.expanded .slider-box {
          touch-action: none;
          /* Taller squircle for expanded state */
          -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'%3E%3Cpath d='M0,28 C0,6 6,0 28,0 L72,0 C94,0 100,6 100,28 L100,92 C100,114 94,120 72,120 L28,120 C6,120 0,114 0,92 Z' fill='black'/%3E%3C/svg%3E");
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120'%3E%3Cpath d='M0,28 C0,6 6,0 28,0 L72,0 C94,0 100,6 100,28 L100,92 C100,114 94,120 72,120 L28,120 C6,120 0,114 0,92 Z' fill='black'/%3E%3C/svg%3E");
        }

        .slider-fill {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 100%;
          background: rgba(255, 255, 255, 0.95);
          transform: scaleY(0);
          transform-origin: bottom center;
          will-change: transform;
          opacity: 0;
          transition: transform 0.1s ease-out, opacity 0.25s ease;
        }

        .card.expanded .slider-fill {
          opacity: 1;
        }

        .slider-content {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1;
          transition: justify-content 0.3s ease, padding 0.3s ease;
        }

        .card.expanded .slider-content {
          justify-content: flex-start;
          padding-top: 30px;
        }

        .target-temp {
          font-family: -apple-system, sans-serif;
          font-size: 90px;
          font-weight: 400;
          line-height: 1;
          letter-spacing: -2px;
          color: white;
          will-change: color;
          transition: color 0.1s ease-out;
        }

        .target-temp .decimal {
          font-size: 40px;
          vertical-align: baseline;
          margin-left: -2px;
        }

        .target-temp .degree {
          font-size: 24px;
          margin-left: -21px;
          font-weight: bold;
          top: -48px;
          position: relative;
        }

        .bottom-info {
          display: flex;
          justify-content: space-around;
          width: 100%;
          padding-top: 16px;
        }

        .info-item {
          text-align: center;
        }

        .info-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          opacity: 0.75;
          margin-bottom: 2px;
        }

        .info-value {
          font-family: -apple-system, sans-serif;
          font-size: 32px;
          font-weight: 400;
        }

        .info-value .decimal {
          font-size: 15px;
        }

        .info-value .unit {
          font-size: 14px;
          opacity: 0.8;
        }
      </style>

      <ha-card>
        <div class="card ${this._expanded ? 'expanded' : ''}" style="--card-bg: ${background}">
          <div class="header">
            <div class="status-text">${statusText}</div>
            <button class="collapse-btn">✕</button>
          </div>

          <div class="slider-container">
            <div class="slider-wrapper">
              <div class="slider-box">
                <div class="slider-fill" style="transform: scaleY(${fillRatio})"></div>
                <div class="slider-content">
                  <div class="target-temp" style="color: ${this._expanded && fillRatio > 0.75 ? '#3A3A3C' : 'white'}">
                    ${targetWhole}<span class="decimal">.${targetDecimal}</span><span class="degree">⭘</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bottom-info">
            <div class="info-item">
              <div class="info-label">${this._hass.localize('ui.card.climate.currently') || 'Currently'}</div>
              <div class="info-value current-temp">
                ${currentWhole}<span class="decimal">.${currentDecimal}</span><span class="unit">°</span>
              </div>
            </div>
            <div class="info-item secondary-item" style="display: ${secondary !== null ? 'block' : 'none'}">
              <div class="info-label secondary-label">${secondary?.label || ''}</div>
              <div class="info-value secondary-value">
                ${secondary !== null ? secondary.value : '0'}<span class="unit"> ${secondary?.unit || ''}</span>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  _updateValues(statusText, targetWhole, targetDecimal, fillRatio, currentWhole, currentDecimal, secondary, background) {
    const statusEl = this.shadowRoot.querySelector('.status-text');
    const targetEl = this.shadowRoot.querySelector('.target-temp');
    const fillEl = this.shadowRoot.querySelector('.slider-fill');
    const currentEl = this.shadowRoot.querySelector('.current-temp');
    const secondaryEl = this.shadowRoot.querySelector('.secondary-value');
    const secondaryItem = this.shadowRoot.querySelector('.secondary-item');
    const secondaryLabel = this.shadowRoot.querySelector('.secondary-label');
    const card = this.shadowRoot.querySelector('.card');

    if (statusEl) statusEl.textContent = statusText;
    if (card) card.style.setProperty('--card-bg', background);

    if (targetEl && !this._isDragging) {
      targetEl.innerHTML = `${targetWhole}<span class="decimal">.${targetDecimal}</span><span class="degree">⭘</span>`;
      targetEl.style.color = this._expanded && fillRatio > 0.75 ? '#3A3A3C' : 'white';
    }

    if (fillEl && !this._isDragging) {
      fillEl.style.transform = `scaleY(${fillRatio})`;
    }

    if (currentEl) {
      currentEl.innerHTML = `${currentWhole}<span class="decimal">.${currentDecimal}</span><span class="unit">°</span>`;
    }

    if (secondaryItem) {
      secondaryItem.style.display = secondary !== null ? 'block' : 'none';
    }
    if (secondaryLabel && secondary !== null) {
      secondaryLabel.textContent = secondary.label;
    }
    if (secondaryEl && secondary !== null) {
      secondaryEl.innerHTML = `${secondary.value}<span class="unit"> ${secondary.unit}</span>`;
    }
  }
}

customElements.define('glass-thermostat-card', GlassThermostatCard);

// ========== EDITOR ==========
class GlassThermostatCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
  }

  static get schema() {
    return [
      {
        name: 'entity',
        required: true,
        selector: { entity: { domain: 'climate' } }
      },
      {
        name: 'secondary_entity',
        selector: { entity: { domain: ['sensor', 'input_number', 'counter', 'number'] } }
      },
      {
        name: 'secondary_label',
        selector: { text: {} }
      }
    ];
  }

  setConfig(config) {
    this._config = { ...config };
    // Update existing form data instead of re-rendering
    const form = this.querySelector('ha-form');
    if (form) {
      form.data = this._config;
    } else if (this._hass) {
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    const form = this.querySelector('ha-form');
    if (form) {
      form.hass = hass;
    } else {
      this._render();
    }
  }

  _render() {
    if (!this._hass) return;
    if (this.querySelector('ha-form')) return; // Already rendered

    const form = document.createElement('ha-form');
    form.hass = this._hass;
    form.data = this._config;
    form.schema = [
      {
        name: 'entity',
        required: true,
        selector: { entity: { domain: 'climate' } }
      },
      {
        name: 'secondary_entity',
        label: 'Secondary Info Entity',
        selector: { entity: { domain: ['sensor', 'input_number', 'counter', 'number'] } }
      },
      {
        name: 'secondary_label',
        label: 'Secondary Info Label',
        selector: { text: {} }
      }
    ];
    form.computeLabel = (schema) => {
      const labels = {
        entity: 'Climate Entity',
        secondary_entity: 'Secondary Info Entity (optional)',
        secondary_label: 'Secondary Info Label (optional)'
      };
      return labels[schema.name] || schema.name;
    };

    form.addEventListener('value-changed', (e) => {
      this._config = e.detail.value;
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true
      }));
    });

    this.appendChild(form);
  }
}

customElements.define('glass-thermostat-card-editor', GlassThermostatCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'glass-thermostat-card',
  name: 'Glass Thermostat Card',
  description: 'Liquid glass style thermostat with collapsible temperature slider',
  preview: true,
});

console.info(
  `%c GLASS-THERMOSTAT-CARD %c v${VERSION} `,
  'color: white; background: #ff6600; font-weight: 700;',
  'color: #ff6600; background: white; font-weight: 700;'
);
