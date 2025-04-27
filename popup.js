// Update the counter display
function updateCounter() {
  chrome.storage.local.get(['trackerCount'], function(result) {
    document.getElementById('trackerCount').textContent = result.trackerCount || 0;
  });
}

// Update counter when popup opens
updateCounter();

// Listen for changes in tracker count
chrome.storage.onChanged.addListener(function(changes) {
  if (changes.trackerCount) {
    updateCounter();
  }
}); 