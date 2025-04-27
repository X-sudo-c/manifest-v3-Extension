// Get references to all tracker count elements
const urlCountElement = document.getElementById('urlCount');
const networkCountElement = document.getElementById('networkCount');
const canvasCountElement = document.getElementById('canvasCount');
const webglCountElement = document.getElementById('webglCount');
const storageCountElement = document.getElementById('storageCount');
const behavioralCountElement = document.getElementById('behavioralCount');
const totalCountElement = document.getElementById('totalCount');

// Function to update the UI with tracker counts
function updateTrackerCounts(counts) {
  // Update individual tracker counts
  urlCountElement.textContent = counts.url || 0;
  networkCountElement.textContent = counts.network || 0;
  canvasCountElement.textContent = counts.canvas || 0;
  webglCountElement.textContent = counts.webgl || 0;
  storageCountElement.textContent = counts.storage || 0;
  behavioralCountElement.textContent = counts.behavioral || 0;

  // Calculate and update total count
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  totalCountElement.textContent = total;
}

// Get initial counts from storage
chrome.storage.local.get(['trackerCount'], (result) => {
  if (chrome.runtime.lastError) {
    console.error('Error getting initial counts:', chrome.runtime.lastError);
  } else {
    updateTrackerCounts(result.trackerCount || {});
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.trackerCount) {
    updateTrackerCounts(changes.trackerCount.newValue);
  }
}); 