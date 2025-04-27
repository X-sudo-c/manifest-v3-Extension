// Trackers commonly found in URLs
const URL_TRACKERS = [
  'utm_',
  'gclid',
  'fbclid',
  'msclkid',
  'ref=',
  'tag=',
  'campaign',
  'source',
  'medium',
  'term',
  'content',
  'clickid',
  'affiliate',
  'partner',
  'tracking',
  'redirect',
  'adgrpid',
  'hvadid',
  'hvpos',
  'hvnetw',
  'hvrand',
  'hvqmt',
  'hvtargid',
  'hydadcr'
];

// Known tracking domains
const TRACKING_DOMAINS = [
  'doubleclick.net',
  'google-analytics.com',
  'facebook.com',
  'facebook.net',
  'googletagmanager.com',
  'hotjar.com',
  'mixpanel.com',
  'amplitude.com',
  'segment.com',
  'matomo',
  'piwik',
  'adroll.com',
  'adsystem.com',
  'amazon-adsystem.com'
];

// Function to detect canvas fingerprinting
function detectCanvasFingerprinting() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Check for canvas fingerprinting attempts
    const originalGetImageData = ctx.getImageData;
    let canvasAccessed = false;

    ctx.getImageData = function() {
      canvasAccessed = true;
      return originalGetImageData.apply(this, arguments);
    };

    // Common fingerprinting patterns
    ctx.fillText('Cwm fjordbank glyphs vext quiz', 2, 5);
    ctx.getImageData(0, 0, 1, 1);

    return canvasAccessed;
  } catch (e) {
    return false;
  }
}

// Function to detect WebGL fingerprinting
function detectWebGLFingerprinting() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;

    // Check for WebGL fingerprinting attempts
    const originalGetParameter = gl.getParameter;
    let webglAccessed = false;

    gl.getParameter = function() {
      webglAccessed = true;
      return originalGetParameter.apply(this, arguments);
    };

    // Common WebGL fingerprinting calls
    gl.getParameter(gl.VERSION);
    gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

    return webglAccessed;
  } catch (e) {
    return false;
  }
}

// Function to detect storage-based tracking
function detectStorageTracking() {
  let storageTrackers = 0;
  
  try {
    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (TRACKING_DOMAINS.some(domain => key.includes(domain))) {
        storageTrackers++;
      }
    }

    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (TRACKING_DOMAINS.some(domain => key.includes(domain))) {
        storageTrackers++;
      }
    }

    // Check cookies
    document.cookie.split(';').forEach(cookie => {
      if (TRACKING_DOMAINS.some(domain => cookie.includes(domain))) {
        storageTrackers++;
      }
    });
  } catch (e) {
    console.error('Error checking storage:', e);
  }

  return storageTrackers;
}

// Function to detect behavioral tracking
function detectBehavioralTracking() {
  let behavioralTrackers = 0;
  
  try {
    // Check for tracking scripts
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      const content = script.textContent || '';
      if (content.includes('addEventListener') && 
          (content.includes('mousemove') || 
           content.includes('scroll') || 
           content.includes('click') || 
           content.includes('keypress'))) {
        behavioralTrackers++;
      }
    });

    // Check for known tracking libraries
    const trackingLibraries = [
      'hotjar',
      'mixpanel',
      'amplitude',
      'segment',
      'matomo',
      'piwik',
      'google-analytics',
      'gtag',
      'ga',
      'fbq',
      'fb-pixel'
    ];

    // Check script sources
    document.querySelectorAll('script[src]').forEach(script => {
      if (trackingLibraries.some(lib => script.src.includes(lib))) {
        behavioralTrackers++;
      }
    });

    // Check for tracking iframes
    document.querySelectorAll('iframe').forEach(iframe => {
      if (trackingLibraries.some(lib => iframe.src.includes(lib))) {
        behavioralTrackers++;
      }
    });
  } catch (error) {
    console.error('Error detecting behavioral tracking:', error);
  }

  return behavioralTrackers;
}

// Function to check if a URL contains tracking parameters
function isTrackingUrl(url) {
  try {
    const urlObj = new URL(url);
    // Check URL parameters
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (URL_TRACKERS.some(tracker => key.toLowerCase().includes(tracker))) {
        return true;
      }
    }
    // Check URL path for tracking patterns
    if (URL_TRACKERS.some(tracker => urlObj.pathname.toLowerCase().includes(tracker))) {
      return true;
    }
    // Check for tracking domains
    if (TRACKING_DOMAINS.some(domain => urlObj.hostname.includes(domain))) {
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error parsing URL:', e);
    return false;
  }
}

// Function to scan the current page for trackers
function scanPageForTrackers() {
  const counts = {
    url: 0,
    network: 0,
    canvas: 0,
    webgl: 0,
    storage: 0,
    behavioral: 0
  };
  
  try {
    // Check current URL
    if (isTrackingUrl(window.location.href)) {
      counts.url++;
    }
    
    // Check all links on the page
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      if (isTrackingUrl(link.href)) {
        counts.url++;
      }
    });
    
    // Check all scripts and iframes
    const resources = document.querySelectorAll('script[src], iframe[src]');
    resources.forEach(resource => {
      if (isTrackingUrl(resource.src)) {
        counts.network++;
      }
    });

    // Check for DOM-based tracking
    if (detectCanvasFingerprinting()) {
      counts.canvas++;
    }
    if (detectWebGLFingerprinting()) {
      counts.webgl++;
    }
    counts.storage = detectStorageTracking();
    counts.behavioral = detectBehavioralTracking();
  } catch (error) {
    console.error('Error scanning page for trackers:', error);
  }
  
  return counts;
}

// Function to notify background script about trackers
function notifyTracking(counts) {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Chrome runtime not available');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({
        type: 'TRACKER_COUNT',
        counts: counts
      }, response => {
        if (chrome.runtime.lastError) {
          // Ignore connection errors
          if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
            console.log('Background script not ready, will retry later');
            resolve();
          } else {
            console.error('Error sending message:', chrome.runtime.lastError.message);
            reject(chrome.runtime.lastError);
          }
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('Error in notifyTracking:', error);
      reject(error);
    }
  });
}

// Wait for the page to be fully loaded
async function initialize() {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        const counts = scanPageForTrackers();
        await notifyTracking(counts).catch(() => {
          // Ignore errors, we'll retry on the next scan
        });
      });
    } else {
      const counts = scanPageForTrackers();
      await notifyTracking(counts).catch(() => {
        // Ignore errors, we'll retry on the next scan
      });
    }
  } catch (error) {
    console.error('Error in initialize:', error);
  }
}

// Initialize the content script
initialize();

// Listen for URL changes (for single-page applications)
let lastUrl = location.href;
const observer = new MutationObserver(async () => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    try {
      const counts = scanPageForTrackers();
      await notifyTracking(counts).catch(() => {
        // Ignore errors, we'll retry on the next scan
      });
    } catch (error) {
      console.error('Error handling URL change:', error);
    }
  }
});

// Start observing
observer.observe(document, { 
  subtree: true, 
  childList: true 
}); 