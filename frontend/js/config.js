/**
 * Application API Configuration
 * Supports local development and production Render deployment.
 */
const CONFIG = {
  // If API URL is stored in localStorage by admin or preset via environment
  // Default to relative /api if served together, or localhost:4000 in dev
  getApiBaseUrl() {
    const customUrl = localStorage.getItem('MINECRAFT_PORTAL_API_URL');
    if (customUrl) return customUrl.replace(/\/+$/, '');

    // In production on Render Static Site, the user or admin can specify the backend URL
    // Default fallback to window.location origin if API is co-hosted or localhost:4000
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // In dev with live server or file://
      return 'http://localhost:4000';
    }

    // Default Render backend placeholder if configured in meta tag or fallback
    const metaApi = document.querySelector('meta[name="portal-api-url"]');
    if (metaApi && metaApi.content && !metaApi.content.startsWith('__')) {
      return metaApi.content.replace(/\/+$/, '');
    }

    return '';
  },

  setApiBaseUrl(url) {
    if (url) {
      localStorage.setItem('MINECRAFT_PORTAL_API_URL', url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('MINECRAFT_PORTAL_API_URL');
    }
  }
};
