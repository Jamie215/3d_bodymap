// js/utils/responsiveManager.js
// Centralized responsive breakpoint management

export class ResponsiveManager {
  constructor() {
    // Match CSS breakpoints exactly
    this.breakpoints = {
      xs: 480,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536
    };
    
    // Cache media queries for better performance
    this.mediaQueries = {
      xs: window.matchMedia(`(max-width: ${this.breakpoints.xs}px)`),
      sm: window.matchMedia(`(max-width: ${this.breakpoints.sm}px)`),
      md: window.matchMedia(`(max-width: ${this.breakpoints.md}px)`),
      lg: window.matchMedia(`(max-width: ${this.breakpoints.lg}px)`),
      xl: window.matchMedia(`(max-width: ${this.breakpoints.xl}px)`),
      isMobile: window.matchMedia(`(max-width: ${this.breakpoints.md - 1}px)`),
      isTablet: window.matchMedia(`(min-width: ${this.breakpoints.md}px) and (max-width: ${this.breakpoints.lg - 1}px)`),
      isDesktop: window.matchMedia(`(min-width: ${this.breakpoints.lg}px)`),
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      isTouch: window.matchMedia('(pointer: coarse)'),
      isLandscape: window.matchMedia('(orientation: landscape)'),
      isPortrait: window.matchMedia('(orientation: portrait)')
    };
    
    this.currentBreakpoint = this.getCurrentBreakpoint();
    this.listeners = new Map();
    
    // Set up listeners
    this.setupListeners();
  }
  
  getCurrentBreakpoint() {
    const width = window.innerWidth;
    if (width < this.breakpoints.xs) return 'xs';
    if (width < this.breakpoints.sm) return 'sm';
    if (width < this.breakpoints.md) return 'md';
    if (width < this.breakpoints.lg) return 'lg';
    if (width < this.breakpoints.xl) return 'xl';
    return '2xl';
  }
  
  setupListeners() {
    // Listen for all media query changes
    Object.entries(this.mediaQueries).forEach(([key, mq]) => {
      mq.addEventListener('change', (e) => {
        this.handleMediaQueryChange(key, e.matches);
      });
    });
  }
  
  handleMediaQueryChange(query, matches) {
    const oldBreakpoint = this.currentBreakpoint;
    this.currentBreakpoint = this.getCurrentBreakpoint();
    
    // Notify listeners
    if (this.listeners.has(query)) {
      this.listeners.get(query).forEach(callback => callback(matches));
    }
    
    // Notify breakpoint change listeners
    if (oldBreakpoint !== this.currentBreakpoint) {
      if (this.listeners.has('breakpointChange')) {
        this.listeners.get('breakpointChange').forEach(callback => 
          callback(this.currentBreakpoint, oldBreakpoint)
        );
      }
    }
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  is(query) {
    if (this.mediaQueries[query]) {
      return this.mediaQueries[query].matches;
    }
    return false;
  }
  
  getViewportType() {
    if (this.is('isMobile')) return 'mobile';
    if (this.is('isTablet')) return 'tablet';
    return 'desktop';
  }
  
  // Utility method to check if we should show mobile UI
  shouldUseMobileUI() {
    return this.is('isMobile') || this.is('isTablet');
  }
  
  // Get current window dimensions
  getDimensions() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      breakpoint: this.currentBreakpoint,
      viewportType: this.getViewportType(),
      isTouch: this.is('isTouch'),
      isLandscape: this.is('isLandscape')
    };
  }
}

// Create singleton instance
let responsiveManager = null;

export function getResponsiveManager() {
  if (!responsiveManager) {
    responsiveManager = new ResponsiveManager();
  }
  return responsiveManager;
}

export default getResponsiveManager();