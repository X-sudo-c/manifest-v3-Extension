let trackerCount = {
  url: 0,
  network: 0,
  canvas: 0,
  webgl: 0,
  storage: 0,
  behavioral: 0
};
let easyListRules = [];
let currentTabId = null;

// Store the last fetch timestamp
const LAST_FETCH_KEY = 'lastEasyListFetch';
const RULES_KEY = 'easyListRules';

// Maximum number of rules per set
const MAX_RULES_PER_SET = 10000;

// Optimize rules by combining similar patterns
function optimizeRules(rules) {
  const optimized = new Map();
  
  rules.forEach(rule => {
    // Extract domain and path
    const parts = rule.split('/');
    const domain = parts[0];
    const path = parts.slice(1).join('/');
    
    // Group by domain
    if (!optimized.has(domain)) {
      optimized.set(domain, new Set());
    }
    optimized.get(domain).add(path);
  });
  
  // Convert back to rules with wildcards
  const result = [];
  for (const [domain, paths] of optimized.entries()) {
    if (paths.size > 1) {
      // If multiple paths for same domain, use wildcard
      result.push(`${domain}/*`);
    } else {
      // Otherwise use specific path
      result.push(`${domain}/${Array.from(paths)[0]}`);
    }
  }
  
  return result;
}

// Split rules into chunks
function chunkRules(rules, size) {
  const chunks = [];
  for (let i = 0; i < rules.length; i += size) {
    chunks.push(rules.slice(i, i + size));
  }
  return chunks;
}

// Check if we need to fetch the list (not fetched in last 24 hours)
async function shouldFetchEasyList() {
  const result = await chrome.storage.local.get([LAST_FETCH_KEY]);
  const lastFetch = result[LAST_FETCH_KEY];
  if (!lastFetch) return true;
  
  const oneDay = 24 * 60 * 60 * 1000;
  return Date.now() - lastFetch > oneDay;
}

// Fetch EasyList rules
async function fetchEasyList() {
  try {
    // Check if we have cached rules and they're recent
    const shouldFetch = await shouldFetchEasyList();
    if (!shouldFetch) {
      const cachedRules = await chrome.storage.local.get([RULES_KEY]);
      if (cachedRules[RULES_KEY]) {
        easyListRules = cachedRules[RULES_KEY];
        console.log('Using cached EasyList rules');
        return;
      }
    }

    console.log('Fetching EasyList rules...');
    const response = await fetch('https://easylist.to/easylist/easylist.txt');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    
    // Extract and optimize rules
    let rules = text.split('\n')
      .filter(line => line.startsWith('||') && line.includes('^'))
      .map(line => line.replace('||', '').split('^')[0]);
    
    console.log(`Found ${rules.length} raw rules`);
    
    // Optimize rules
    rules = optimizeRules(rules);
    console.log(`Optimized to ${rules.length} rules`);
    
    // Split into chunks
    const ruleChunks = chunkRules(rules, MAX_RULES_PER_SET);
    console.log(`Split into ${ruleChunks.length} chunks`);
    
    // Cache the rules and update last fetch time
    await chrome.storage.local.set({
      [RULES_KEY]: rules,
      [LAST_FETCH_KEY]: Date.now()
    });
    
    // Process each chunk
    for (let i = 0; i < ruleChunks.length; i++) {
      const chunk = ruleChunks[i];
      const chunkRules = chunk.map((rule, index) => ({
        id: (i * MAX_RULES_PER_SET) + index + 1,
        priority: 1,
        action: { type: 'allow' },
        condition: {
          urlFilter: rule,
          resourceTypes: ['script', 'image', 'xmlhttprequest']
        }
      }));

      // Update rules for this chunk
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: chunkRules.map(rule => rule.id),
        addRules: chunkRules
      });
      console.log(`Updated chunk ${i + 1}/${ruleChunks.length}`);
    }
    
    console.log('Successfully updated all rule chunks');
  } catch (error) {
    console.error('Error in fetchEasyList:', error);
    // Try to use cached rules if available
    const cachedRules = await chrome.storage.local.get([RULES_KEY]);
    if (cachedRules[RULES_KEY]) {
      easyListRules = cachedRules[RULES_KEY];
      console.log('Falling back to cached EasyList rules');
    }
  }
}

// Reset counter for a specific tab
async function resetCounter(tabId) {
  trackerCount = {
    url: 0,
    network: 0,
    canvas: 0,
    webgl: 0,
    storage: 0,
    behavioral: 0
  };
  currentTabId = tabId;
  await chrome.storage.local.set({ trackerCount });
  console.log(`Reset tracker count for tab ${tabId}`);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRACKER_COUNT') {
    try {
      // Only count trackers for the current tab
      if (sender.tab.id === currentTabId) {
        // Update counts for each type
        Object.keys(message.counts).forEach(type => {
          trackerCount[type] += message.counts[type];
        });
        
        // Store updated counts
        chrome.storage.local.set({ trackerCount }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error storing counts:', chrome.runtime.lastError);
          }
        });
        
        console.log(`Content script detected trackers for tab ${currentTabId}:`, message.counts);
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error handling tracker count:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCounts') {
    // Get the latest counts from storage
    chrome.storage.local.get(['trackerCount'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting counts:', chrome.runtime.lastError);
        sendResponse({ counts: trackerCount }); // Fallback to in-memory counts
      } else {
        sendResponse({ counts: result.trackerCount || trackerCount });
      }
    });
    return true; // Keep the message channel open for async response
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    resetCounter(tabId);
  }
});

// Handle tab activation (switching tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  resetCounter(activeInfo.tabId);
});

// Initialize
console.log('Initializing Tracker Counter extension...');
fetchEasyList(); 