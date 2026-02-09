/* eslint-disable no-console */
/**
 * Custom Tabs Solution
 *
 * A lightweight, attribute-based tabs implementation for Webflow.
 * Supports triggers and content panels anywhere in the DOM using group-based linking.
 * Optional CSS-driven animations between tab transitions.
 *
 * Usage in Webflow:
 * -----------------
 * Triggers and content can be anywhere on the page - they're linked by group name:
 *
 * <!-- Navigation in header -->
 * <nav>
 *   <button bw-tabs-trigger="photos" bw-tabs-group="gallery">Foton</button>
 *   <button bw-tabs-trigger="videos" bw-tabs-group="gallery">Videos</button>
 * </nav>
 *
 * <!-- Content in main section -->
 * <main>
 *   <div bw-tabs-content="photos" bw-tabs-group="gallery">Photo content...</div>
 *   <div bw-tabs-content="videos" bw-tabs-group="gallery">Video content...</div>
 * </main>
 *
 * Optional attributes:
 * - bw-tabs-default: Mark which tab should be active on load
 * - bw-tabs-class: Custom active class (default: "is-tab-active")
 * - bw-tabs-animate: Enable CSS transitions between tabs
 * - bw-tabs-duration: Animation duration in ms (default: 300)
 *
 * Animation example:
 * <button bw-tabs-trigger="photos" bw-tabs-group="gallery" bw-tabs-animate bw-tabs-duration="400">
 *
 * Animation CSS classes:
 * - .is-leaving: Applied to outgoing panel during exit animation
 * - .is-entering: Applied to incoming panel during enter animation
 *
 * CSS for animations:
 * -------------------
 * [bw-tabs-content] {
 *   display: none;
 *   opacity: 0;
 * }
 * [bw-tabs-content].is-tab-active {
 *   display: block;
 *   opacity: 1;
 *   transition: opacity 0.3s ease;
 * }
 * [bw-tabs-content].is-leaving {
 *   display: block;
 *   opacity: 0;
 *   transition: opacity 0.2s ease;
 * }
 * [bw-tabs-content].is-entering {
 *   display: block;
 *   opacity: 0;
 * }
 */

// ============================================================================
// Configuration
// ============================================================================

// Default values
const DEFAULT_ACTIVE_CLASS = 'is-tab-active';
const DEFAULT_ANIMATION_DURATION = 300;

// Animation state classes
const ANIM_CLASS = {
  leaving: 'is-leaving',
  entering: 'is-entering',
} as const;

// Attribute names
const ATTR = {
  group: 'bw-tabs-group',
  trigger: 'bw-tabs-trigger',
  content: 'bw-tabs-content',
  default: 'bw-tabs-default',
  activeClass: 'bw-tabs-class',
  animate: 'bw-tabs-animate',
  duration: 'bw-tabs-duration',
} as const;

// ============================================================================
// Types
// ============================================================================

type TabsGroup = {
  name: string;
  triggers: HTMLElement[];
  panels: HTMLElement[];
  activeClass: string;
  animate: boolean;
  duration: number;
  isAnimating: boolean; // Prevent rapid clicks during animation
};

// Store for all initialized groups
const tabsGroups = new Map<string, TabsGroup>();

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Discovers and initializes all tabs groups on the page.
 */
function initAllTabs(): void {
  const allGroupElements = document.querySelectorAll(`[${ATTR.group}]`);
  const groupNames = new Set<string>();

  allGroupElements.forEach((el) => {
    const groupName = el.getAttribute(ATTR.group);
    if (groupName) {
      groupNames.add(groupName);
    }
  });

  groupNames.forEach((groupName) => {
    initTabsGroup(groupName);
  });

  console.log(`[Tabs] Initialized ${groupNames.size} tabs group(s)`);
}

/**
 * Initializes a single tabs group by name.
 */
function initTabsGroup(groupName: string): void {
  const triggers = Array.from(
    document.querySelectorAll(`[${ATTR.group}="${groupName}"][${ATTR.trigger}]`)
  ) as HTMLElement[];

  const panels = Array.from(
    document.querySelectorAll(`[${ATTR.group}="${groupName}"][${ATTR.content}]`)
  ) as HTMLElement[];

  if (triggers.length === 0) {
    console.warn(`[Tabs] No triggers found for group "${groupName}"`);
    return;
  }

  if (panels.length === 0) {
    console.warn(`[Tabs] No panels found for group "${groupName}"`);
    return;
  }

  // Get configuration from first trigger
  const firstTrigger = triggers[0];
  const activeClass = firstTrigger?.getAttribute(ATTR.activeClass) || DEFAULT_ACTIVE_CLASS;
  const animate = firstTrigger?.hasAttribute(ATTR.animate) || false;
  const durationAttr = firstTrigger?.getAttribute(ATTR.duration);
  const duration = durationAttr ? parseInt(durationAttr, 10) : DEFAULT_ANIMATION_DURATION;

  const group: TabsGroup = {
    name: groupName,
    triggers,
    panels,
    activeClass,
    animate,
    duration,
    isAnimating: false,
  };
  tabsGroups.set(groupName, group);

  // Attach click handlers
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = trigger.getAttribute(ATTR.trigger);
      if (tabId) {
        activateTab(groupName, tabId);
      }
    });

    // Keyboard support
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      }
    });

    // Make focusable
    if (
      !trigger.hasAttribute('tabindex') &&
      trigger.tagName !== 'BUTTON' &&
      trigger.tagName !== 'A'
    ) {
      trigger.setAttribute('tabindex', '0');
    }
    trigger.setAttribute('role', 'tab');
  });

  // Set ARIA roles
  panels.forEach((panel) => {
    panel.setAttribute('role', 'tabpanel');
  });

  // Activate default tab (without animation on first load)
  const defaultTrigger = triggers.find((t) => t.hasAttribute(ATTR.default));
  const defaultTabId = defaultTrigger
    ? defaultTrigger.getAttribute(ATTR.trigger)
    : triggers[0]?.getAttribute(ATTR.trigger);

  if (defaultTabId) {
    activateTabInstant(group, defaultTabId);
  }
}

/**
 * Activates a tab instantly without animation (used for initial load).
 */
function activateTabInstant(group: TabsGroup, tabId: string): void {
  const { triggers, panels, activeClass } = group;

  // Deactivate all
  triggers.forEach((trigger) => {
    trigger.classList.remove(activeClass);
    trigger.setAttribute('aria-selected', 'false');
  });
  panels.forEach((panel) => {
    panel.classList.remove(activeClass, ANIM_CLASS.leaving, ANIM_CLASS.entering);
    panel.setAttribute('aria-hidden', 'true');
  });

  // Activate matching
  triggers
    .filter((t) => t.getAttribute(ATTR.trigger) === tabId)
    .forEach((trigger) => {
      trigger.classList.add(activeClass);
      trigger.setAttribute('aria-selected', 'true');
    });

  panels
    .filter((p) => p.getAttribute(ATTR.content) === tabId)
    .forEach((panel) => {
      panel.classList.add(activeClass);
      panel.setAttribute('aria-hidden', 'false');
    });
}

/**
 * Activates a specific tab within a group, with optional animation.
 */
function activateTab(groupName: string, tabId: string): void {
  const group = tabsGroups.get(groupName);
  if (!group) {
    console.warn(`[Tabs] Group "${groupName}" not found`);
    return;
  }

  // Prevent rapid clicks during animation
  if (group.isAnimating) {
    return;
  }

  const { triggers, panels, activeClass, animate, duration } = group;

  // Find current and next panels
  const currentPanel = panels.find((p) => p.classList.contains(activeClass));
  const nextPanels = panels.filter((p) => p.getAttribute(ATTR.content) === tabId);

  // If clicking the same tab, do nothing
  if (currentPanel && nextPanels.includes(currentPanel)) {
    return;
  }

  // Update triggers immediately
  triggers.forEach((trigger) => {
    trigger.classList.remove(activeClass);
    trigger.setAttribute('aria-selected', 'false');
  });
  triggers
    .filter((t) => t.getAttribute(ATTR.trigger) === tabId)
    .forEach((trigger) => {
      trigger.classList.add(activeClass);
      trigger.setAttribute('aria-selected', 'true');
    });

  // Handle animation or instant switch
  if (animate && currentPanel) {
    animateTransition(group, currentPanel, nextPanels, tabId);
  } else {
    // No animation - instant switch
    panels.forEach((panel) => {
      panel.classList.remove(activeClass);
      panel.setAttribute('aria-hidden', 'true');
    });
    nextPanels.forEach((panel) => {
      panel.classList.add(activeClass);
      panel.setAttribute('aria-hidden', 'false');
    });
  }
}

/**
 * Handles animated transition between panels.
 */
function animateTransition(
  group: TabsGroup,
  currentPanel: HTMLElement,
  nextPanels: HTMLElement[],
  tabId: string
): void {
  const { panels, activeClass, duration } = group;

  // Lock animation state
  group.isAnimating = true;

  // Phase 1: Exit animation on current panel
  currentPanel.classList.add(ANIM_CLASS.leaving);
  currentPanel.classList.remove(activeClass);

  // Wait for exit animation
  setTimeout(() => {
    // Clean up current panel
    currentPanel.classList.remove(ANIM_CLASS.leaving);
    currentPanel.setAttribute('aria-hidden', 'true');

    // Deactivate all other panels
    panels.forEach((panel) => {
      if (!nextPanels.includes(panel)) {
        panel.classList.remove(activeClass, ANIM_CLASS.leaving, ANIM_CLASS.entering);
        panel.setAttribute('aria-hidden', 'true');
      }
    });

    // Phase 2: Enter animation on next panels
    nextPanels.forEach((panel) => {
      panel.classList.add(ANIM_CLASS.entering);
      panel.setAttribute('aria-hidden', 'false');
    });

    // Force reflow to ensure entering class is applied before adding active
    void nextPanels[0]?.offsetHeight;

    // Add active class to trigger enter animation
    nextPanels.forEach((panel) => {
      panel.classList.add(activeClass);
      panel.classList.remove(ANIM_CLASS.entering);
    });

    // Unlock after enter animation completes
    setTimeout(() => {
      group.isAnimating = false;
    }, duration / 2);
  }, duration / 2);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Programmatically switch to a specific tab.
 */
export function switchTab(groupName: string, tabId: string): void {
  if (tabsGroups.has(groupName)) {
    activateTab(groupName, tabId);
    return;
  }

  initTabsGroup(groupName);
  if (tabsGroups.has(groupName)) {
    activateTab(groupName, tabId);
  } else {
    console.warn(`[Tabs] Cannot switch tab - group "${groupName}" not found`);
  }
}

/**
 * Get the currently active tab ID for a group.
 */
export function getActiveTab(groupName: string): string | null {
  const group = tabsGroups.get(groupName);
  if (!group) return null;

  const activeTrigger = group.triggers.find((t) => t.classList.contains(group.activeClass));
  return activeTrigger?.getAttribute(ATTR.trigger) || null;
}

// ============================================================================
// Initialization
// ============================================================================

window.Webflow ||= [];
window.Webflow.push(() => {
  initAllTabs();
});

export { initAllTabs };
