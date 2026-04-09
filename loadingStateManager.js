/**
 * Loading State Manager for Product Operations
 * This helps manage loading states during product updates and refreshes
 */

class LoadingStateManager {
  constructor() {
    this.loadingStates = new Map();
    this.listeners = new Map();
  }

  // Start loading for a specific operation
  startLoading(operationId, productId = null) {
    const key = productId ? `${operationId}:${productId}` : operationId;
    this.loadingStates.set(key, {
      isLoading: true,
      startTime: Date.now(),
      operationId,
      productId
    });
    
    this.notifyListeners(key, { isLoading: true });
    console.log(`[LoadingState] Started loading for ${key}`);
  }

  // Stop loading for a specific operation
  stopLoading(operationId, productId = null, error = null) {
    const key = productId ? `${operationId}:${productId}` : operationId;
    const loadingState = this.loadingStates.get(key);
    
    if (loadingState) {
      const duration = Date.now() - loadingState.startTime;
      this.loadingStates.set(key, {
        ...loadingState,
        isLoading: false,
        endTime: Date.now(),
        duration,
        error
      });
      
      this.notifyListeners(key, { isLoading: false, error, duration });
      console.log(`[LoadingState] Stopped loading for ${key} (${duration}ms)`);
      
      // Clear loading state after a delay
      setTimeout(() => {
        this.loadingStates.delete(key);
        this.notifyListeners(key, { isLoading: false, cleared: true });
      }, 100);
    }
  }

  // Check if an operation is loading
  isLoading(operationId, productId = null) {
    const key = productId ? `${operationId}:${productId}` : operationId;
    const state = this.loadingStates.get(key);
    return state ? state.isLoading : false;
  }

  // Get loading state for an operation
  getLoadingState(operationId, productId = null) {
    const key = productId ? `${operationId}:${productId}` : operationId;
    return this.loadingStates.get(key) || { isLoading: false };
  }

  // Add listener for loading state changes
  addListener(operationId, productId, callback) {
    const key = productId ? `${operationId}:${productId}` : operationId;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
  }

  // Remove listener
  removeListener(operationId, productId, callback) {
    const key = productId ? `${operationId}:${productId}` : operationId;
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(key);
      }
    }
  }

  // Notify all listeners of state changes
  notifyListeners(key, state) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback(state));
    }
  }

  // Get all active loading states
  getAllLoadingStates() {
    return Array.from(this.loadingStates.entries()).map(([key, state]) => ({
      key,
      ...state
    }));
  }

  // Clear all loading states
  clearAll() {
    this.loadingStates.clear();
    this.listeners.clear();
    console.log('[LoadingState] Cleared all loading states');
  }
}

// Export for use in frontend
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadingStateManager;
} else if (typeof window !== 'undefined') {
  window.LoadingStateManager = LoadingStateManager;
}

// Example usage for frontend:
/*
const loadingManager = new LoadingStateManager();

// Start loading for product update
loadingManager.startLoading('updateProduct', productId);

// Make API call
try {
  const response = await fetch(`/api/v1/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });
  const result = await response.json();
  
  // Stop loading on success
  loadingManager.stopLoading('updateProduct', productId);
  
  // Refresh products list
  refreshProducts();
  
} catch (error) {
  // Stop loading with error
  loadingManager.stopLoading('updateProduct', productId, error);
}

// Listen for loading state changes
loadingManager.addListener('updateProduct', productId, (state) => {
  if (state.isLoading) {
    // Show loading UI
    showLoadingSpinner();
  } else {
    // Hide loading UI
    hideLoadingSpinner();
    if (state.error) {
      showError(state.error);
    }
  }
});
*/
