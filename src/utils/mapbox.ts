import type { LngLatBounds as LngLatBoundsType, Map } from 'mapbox-gl';

// Use global mapboxgl loaded via CDN (not bundled)
const { LngLatBounds } = window.mapboxgl as unknown as {
  LngLatBounds: typeof LngLatBoundsType;
};

/**
 * A GeoJSON Point feature with custom properties.
 */
export type PointFeature<T extends Record<string, unknown> = Record<string, unknown>> = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: T;
};

/**
 * A GeoJSON FeatureCollection containing Point features.
 */
export type PointFeatureCollection<T extends Record<string, unknown> = Record<string, unknown>> = {
  type: 'FeatureCollection';
  features: PointFeature<T>[];
};

/**
 * Creates an HTML element from a Webflow template.
 * Falls back to the provided fallback creator if no template is found.
 *
 * @param selector - CSS selector for the template element (e.g., '[data-map-marker]')
 * @param createFallback - Function to create a fallback element if no template exists
 * @returns The cloned template element or fallback
 */
export function createElementFromTemplate(
  selector: string,
  createFallback: () => HTMLElement
): HTMLElement {
  const template = document.querySelector(selector);

  if (template && template instanceof HTMLElement) {
    const element = template.cloneNode(true) as HTMLElement;
    // Extract attribute name from selector like '[data-map-marker]' -> 'data-map-marker'
    const attrMatch = selector.match(/\[([^\]]+)\]/);
    if (attrMatch) {
      element.removeAttribute(attrMatch[1]);
    }
    element.style.display = 'block';
    return element;
  }

  return createFallback();
}

/**
 * Checks if a template element exists in the DOM.
 *
 * @param selector - CSS selector for the template
 * @returns True if the template exists
 */
export function hasTemplate(selector: string): boolean {
  return document.querySelector(selector) !== null;
}

/**
 * Creates popup HTML content from a Webflow template.
 * Injects content into a designated slot within the template.
 *
 * @param templateSelector - CSS selector for the popup template
 * @param contentSlotSelector - Selector for the content slot within the template
 * @param content - HTML content to inject
 * @returns The complete popup HTML string
 */
export function createPopupFromTemplate(
  templateSelector: string,
  contentSlotSelector: string,
  content: string
): string {
  const template = document.querySelector(templateSelector);

  if (template && template instanceof HTMLElement) {
    const popup = template.cloneNode(true) as HTMLElement;
    // Extract attribute name from selector
    const attrMatch = templateSelector.match(/\[([^\]]+)\]/);
    if (attrMatch) {
      popup.removeAttribute(attrMatch[1]);
    }
    popup.style.display = 'block';

    // Inject content into the designated slot
    const contentSlot = popup.querySelector(contentSlotSelector);
    if (contentSlot) {
      contentSlot.innerHTML = content;
    } else {
      popup.innerHTML += content;
    }

    return popup.outerHTML;
  }

  // Fallback: return raw content
  return content;
}

/**
 * Calculates the bounding box that contains all features in a collection.
 *
 * @param features - Array of point features
 * @returns LngLatBounds containing all features, or null if empty
 */
export function calculateBoundsFromFeatures<T extends Record<string, unknown>>(
  features: PointFeature<T>[]
): LngLatBoundsType | null {
  if (features.length === 0) {
    return null;
  }

  const bounds = new LngLatBounds();

  features.forEach((feature) => {
    bounds.extend(feature.geometry.coordinates);
  });

  return bounds;
}

/**
 * Configuration for responsive zoom levels.
 */
export type ResponsiveZoomConfig = {
  desktopZoom: number;
  mobileZoom: number;
  breakpoint: number;
};

/**
 * Returns the appropriate zoom level based on viewport width.
 *
 * @param config - Responsive zoom configuration
 * @returns The zoom level for the current viewport
 */
export function getResponsiveZoom(config: ResponsiveZoomConfig): number {
  const isDesktop = window.matchMedia(`(min-width: ${config.breakpoint}px)`).matches;
  return isDesktop ? config.desktopZoom : config.mobileZoom;
}

/**
 * Configuration for fitting bounds.
 */
export type FitBoundsConfig = {
  padding: number;
  duration: number;
  maxZoom: number;
};

/**
 * Fits the map view to contain all features with smooth animation.
 *
 * @param map - Mapbox map instance
 * @param features - Array of point features
 * @param config - Fit bounds configuration
 * @param fallback - Fallback function if no features (optional)
 */
export function fitMapToFeatures<T extends Record<string, unknown>>(
  map: Map,
  features: PointFeature<T>[],
  config: FitBoundsConfig,
  fallback?: () => void
): void {
  const bounds = calculateBoundsFromFeatures(features);

  if (bounds) {
    map.fitBounds(bounds, {
      padding: config.padding,
      duration: config.duration,
      maxZoom: config.maxZoom,
    });
  } else if (fallback) {
    fallback();
  }
}

let popupStylesInjected = false;

/**
 * Injects CSS to neutralize Mapbox popup default styles.
 * Only runs once to avoid duplicate style tags.
 *
 * @param styleId - Unique ID for the style element
 */
export function injectPopupResetStyles(styleId = 'mapbox-popup-reset-styles'): void {
  if (popupStylesInjected) return;

  const styles = document.createElement('style');
  styles.id = styleId;
  styles.textContent = `
    /* Neutralize Mapbox popup defaults for custom templates */
    .mapboxgl-popup-content {
      background: transparent !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    .mapboxgl-popup-tip {
      display: none !important;
    }
    .mapboxgl-popup-close-button {
      display: none !important;
    }
  `;
  document.head.appendChild(styles);
  popupStylesInjected = true;
}

/**
 * Creates a default circular marker element.
 * Used as fallback when no Webflow template is provided.
 *
 * @param options - Styling options for the marker
 * @returns A styled HTMLElement for use as a marker
 */
export function createDefaultMarker(
  options: {
    size?: number;
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  } = {}
): HTMLElement {
  const { size = 20, color = '#FFC700', borderColor = 'white', borderWidth = 2 } = options;

  const marker = document.createElement('div');
  marker.className = 'map-marker-default';
  marker.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    background: ${color};
    border: ${borderWidth}px solid ${borderColor};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  `;
  return marker;
}
