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
    return false;
  } catch (e) {
    console.error('Error parsing URL:', e);
    return false;
  }
}

// Function to scan the current page for trackers
function scanPageForTrackers() {
  let trackerCount = 0;
  
  try {
    // Check current URL
    if (isTrackingUrl(window.location.href)) {
      trackerCount++;
    }
    
    // Check all links on the page
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      if (isTrackingUrl(link.href)) {
        trackerCount++;
      }
    });
    
    // Check all scripts and iframes
    const resources = document.querySelectorAll('script[src], iframe[src]');
    resources.forEach(resource => {
      if (isTrackingUrl(resource.src)) {
        trackerCount++;
      }
    });
  } catch (error) {
    console.error('Error scanning page for trackers:', error);
  }
  
  return trackerCount;
}

// Function to notify background script about trackers
function notifyTracking(count) {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Chrome runtime not available');
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({
        type: 'TRACKER_COUNT',
        count: count
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
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
        const count = scanPageForTrackers();
        await notifyTracking(count);
      });
    } else {
      const count = scanPageForTrackers();
      await notifyTracking(count);
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
      const count = scanPageForTrackers();
      await notifyTracking(count);
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