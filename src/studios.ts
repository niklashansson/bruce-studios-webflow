/* eslint-disable no-console */
import type { Map, MapOptions, Marker, Popup } from 'mapbox-gl';

// Use global mapboxgl loaded via CDN (not bundled)
const mapboxgl = window.mapboxgl as unknown as typeof import('mapbox-gl').default;

import { getUserLocation } from '$utils/location';
import {
  createDefaultMarker,
  createElementFromTemplate,
  createPopupFromTemplate,
  fitMapToFeatures,
  getResponsiveZoom,
  hasTemplate,
  injectPopupResetStyles,
  type PointFeature,
  type PointFeatureCollection,
} from '$utils/mapbox';

// Injected at build time from .env via esbuild define
declare const __MAPBOX_ACCESS_TOKEN__: string;
const MAPBOX_ACCESS_TOKEN = __MAPBOX_ACCESS_TOKEN__;
const MAPBOX_STYLE = 'mapbox://styles/niklashansson/cmlextxil004n01r3d9gq7uzj';

// Stockholm coordinates as default center
const DEFAULT_CENTER: [number, number] = [18.0686, 59.3293];

// Responsive zoom configuration
const ZOOM_CONFIG = {
  desktopZoom: 3.6,
  mobileZoom: 2.6,
  breakpoint: 480,
};

// Bounds fitting configuration
const FIT_BOUNDS_CONFIG = {
  padding: 200,
  duration: 500,
  maxZoom: 15,
};

// Helper to create data attribute selectors
const elementAttr = (name: string) => `[data-map-element='${name}']`;
const fieldAttr = (name: string) => `[data-map-field='${name}']`;

// All selectors in one place
const S = {
  list: elementAttr('list'),
  lat: fieldAttr('lat'),
  lng: fieldAttr('lng'),
  id: fieldAttr('id'),
  popupInfo: elementAttr('popup-info'),
  marker: elementAttr('marker'),
  popup: elementAttr('popup'),
  popupContent: elementAttr('popup-content'),
} as const;

// State
let studiosMap: Map | null = null;
let activePopup: Popup | null = null;
let activeMarkers: Marker[] = [];

// Types
type LocationProperties = {
  id: string;
  description: string;
};

type LocationFeature = PointFeature<LocationProperties>;
type LocationsGeoJSON = PointFeatureCollection<LocationProperties>;

// GeoJSON Extraction

/**
 * Extracts location data from a list of HTMLElements and converts to GeoJSON format.
 */
function extractLocationsFromElements(elements: HTMLElement[]): LocationsGeoJSON {
  const geoJSON: LocationsGeoJSON = {
    type: 'FeatureCollection',
    features: [],
  };

  elements.forEach((node) => {
    const latElement = node.querySelector(S.lat);
    const lngElement = node.querySelector(S.lng);
    const infoElement = node.querySelector(S.popupInfo);
    const idElement = node.querySelector(S.id);

    if (!latElement || !lngElement || !infoElement || !idElement) {
      console.warn('[Studios Map] Missing required fields in location item', node);
      return;
    }

    const lat = parseFloat(latElement.textContent || '');
    const lng = parseFloat(lngElement.textContent || '');

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('[Studios Map] Invalid coordinates', { lat, lng });
      return;
    }

    const feature: LocationFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      properties: {
        id: idElement.textContent || '',
        description: infoElement.innerHTML,
      },
    };

    geoJSON.features.push(feature);
  });

  return geoJSON;
}

/**
 * Extracts location data from Webflow CMS list container.
 */
function extractLocationsFromCMS(): LocationsGeoJSON {
  const listContainer = document.querySelector(S.list);
  if (!listContainer) {
    console.warn('[Studios Map] List container not found');
    return { type: 'FeatureCollection', features: [] };
  }

  const elements = Array.from(listContainer.childNodes).filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  );

  const geoJSON = extractLocationsFromElements(elements);
  console.log(`[Studios Map] Extracted ${geoJSON.features.length} locations from CMS`);
  return geoJSON;
}

/**
 * Updates the map with new location data.
 */
function updateMapLocations(locations: LocationsGeoJSON): void {
  if (!studiosMap) {
    console.warn('[Studios Map] Map not initialized');
    return;
  }

  // Close any active popup
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }

  // Remove existing markers and add new ones
  clearMarkers();
  addLocationMarkers(studiosMap, locations);

  // Fit map to show all locations
  fitMapToFeatures(studiosMap, locations.features, FIT_BOUNDS_CONFIG, () => {
    studiosMap?.flyTo({
      center: DEFAULT_CENTER,
      zoom: getResponsiveZoom(ZOOM_CONFIG),
      duration: 500,
    });
  });

  console.log(`[Studios Map] Updated with ${locations.features.length} locations`);
}

/**
 * Creates and configures a Mapbox GL map instance.
 */
function createMap(options: Partial<MapOptions> = {}): Map {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
  const map = new mapboxgl.Map({
    container: 'map',
    style: MAPBOX_STYLE,
    center: DEFAULT_CENTER,
    zoom: getResponsiveZoom(ZOOM_CONFIG),
    ...options,
  });
  map.addControl(new mapboxgl.NavigationControl());
  return map;
}

/**
 * Centers the map on the user's location.
 */
function centerOnUserLocation(userCoords: [number, number]): void {
  if (!studiosMap) return;

  studiosMap.flyTo({
    center: userCoords,
    zoom: 8,
    duration: 500,
  });

  console.log('[Studios Map] Centered on user location');
}

/**
 * Removes all existing markers from the map.
 */
function clearMarkers(): void {
  activeMarkers.forEach((marker) => marker.remove());
  activeMarkers = [];
}

/**
 * Creates a marker element from Webflow template or fallback.
 */
function createMarkerElement(): HTMLElement {
  return createElementFromTemplate(S.marker, () => createDefaultMarker());
}

/**
 * Creates popup HTML content from Webflow template or raw description.
 */
function createPopupContent(description: string): string {
  return createPopupFromTemplate(S.popup, S.popupContent, description);
}

/**
 * Checks if a Webflow popup template exists.
 */
function hasPopupTemplate(): boolean {
  return hasTemplate(S.popup);
}

/**
 * Adds HTML markers to the map for each location.
 */
function addLocationMarkers(map: Map, locations: LocationsGeoJSON): void {
  locations.features.forEach((feature) => {
    const { coordinates } = feature.geometry;
    const { description } = feature.properties;

    const markerElement = createMarkerElement();

    const marker = new mapboxgl.Marker({
      element: markerElement,
      anchor: 'center',
    })
      .setLngLat(coordinates)
      .addTo(map);

    // Handle marker click
    markerElement.addEventListener('click', (e) => {
      e.stopPropagation();

      if (activePopup) {
        activePopup.remove();
      }

      const popupHTML = createPopupContent(description);
      const usingTemplate = hasPopupTemplate();

      if (usingTemplate) {
        injectPopupResetStyles();
      }

      activePopup = new mapboxgl.Popup({
        className: 'studios-popup',
        closeButton: !usingTemplate,
        closeOnClick: true,
        maxWidth: 'none',
      })
        .setLngLat(coordinates)
        .setHTML(popupHTML)
        .addTo(map);

      activePopup.on('close', () => {
        activePopup = null;
      });

      map.flyTo({
        center: coordinates,
        speed: 0.5,
        curve: 1,
        easing: (t) => t,
      });
    });

    activeMarkers.push(marker);
  });
}

/**
 * Initializes the studios map with all locations from Webflow CMS.
 */
function initStudiosMap(): void {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) {
    console.warn('[Studios Map] Map container #map not found');
    return;
  }

  const locations = extractLocationsFromCMS();
  studiosMap = createMap();

  studiosMap.on('load', () => {
    if (!studiosMap) return;
    addLocationMarkers(studiosMap, locations);

    // Center on user location or show all studios
    getUserLocation()
      .then((userCoords) => {
        centerOnUserLocation(userCoords);
      })
      .catch((error) => {
        console.log('[Studios Map] Geolocation unavailable:', error.message);
        fitMapToFeatures(studiosMap!, locations.features, FIT_BOUNDS_CONFIG);
      });

    console.log('[Studios Map] Map initialized successfully');
  });
}

// Webflow & Finsweet Integration

window.Webflow ||= [];
window.Webflow.push(() => {
  initStudiosMap();
});

window.FinsweetAttributes = window.FinsweetAttributes || [];
window.FinsweetAttributes.push([
  'list',
  // @ts-expect-error FinsweetAttributes type
  (listInstances) => {
    for (const listInstance of listInstances) {
      if (listInstance.listElement.dataset.mapElement !== 'list') {
        continue;
      }

      listInstance.addHook('filter', (items: { element: HTMLElement }[]) => {
        const elements = items.map((item) => item.element);
        const filteredLocations = extractLocationsFromElements(elements);
        updateMapLocations(filteredLocations);

        console.log(`[Studios Map] Filter changed: ${items.length} items visible`);
        return items;
      });
    }
  },
]);
