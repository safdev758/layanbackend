const WebSocket = require('ws');

// Test WebSocket connection with large payload
const testWebSocketConnection = () => {
  console.log('Testing WebSocket connection with large payload...');
  
  const ws = new WebSocket('ws://localhost:3000');
  
  ws.on('open', function open() {
    console.log('WebSocket connected');
    
    // Test with a large payload that would normally cause issues
    const largeBase64Image = 'data:image/jpeg;base64,' + 'A'.repeat(500000); // 500KB of dummy data
    
    const largePayload = {
      type: 'test_message',
      data: {
        images: [largeBase64Image],
        name: 'Test Product with Large Image'
      }
    };
    
    console.log('Sending large payload...');
    ws.send(JSON.stringify(largePayload));
  });
  
  ws.on('message', function message(data) {
    const parsed = JSON.parse(data);
    console.log('Received message:', parsed);
    
    if (parsed.error) {
      console.log('Error received (expected for large payload):', parsed.error);
    }
  });
  
  ws.on('error', function error(err) {
    console.error('WebSocket error:', err.message);
  });
  
  ws.on('close', function close() {
    console.log('WebSocket disconnected');
  });
  
  // Test connection stability over time
  setTimeout(() => {
    console.log('Sending normal message after large payload test...');
    ws.send(JSON.stringify({ type: 'ping', data: 'normal message' }));
  }, 2000);
  
  setTimeout(() => {
    console.log('Test completed. Closing connection.');
    ws.close();
  }, 5000);
};

// Run the test
testWebSocketConnection();
