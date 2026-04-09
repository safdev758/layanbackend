const axios = require('axios');

// Configuration
const BASE_URL = 'https://semiexpansible-darline-oversubtly.ngrok-free.dev';

// Use test driver account or your actual account
// For your account (a@example.com), update the password below
const DRIVER_EMAIL = process.env.DRIVER_EMAIL || 'a@example.com';
const DRIVER_PASSWORD = process.env.DRIVER_PASSWORD || 'YourPasswordHere'; // <-- UPDATE THIS

console.log('📝 Testing with account:', DRIVER_EMAIL);
console.log('💡 Set DRIVER_EMAIL and DRIVER_PASSWORD env vars to use different credentials\n');

async function testDriverWorkflow() {
  try {
    console.log('🚗 Testing Driver Workflow\n');
    console.log('=' .repeat(60));

    // Step 1: Login as driver
    console.log('\n1️⃣ Logging in as driver...');
    const loginResponse = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email: DRIVER_EMAIL,
      password: DRIVER_PASSWORD
    });

    const { token, user } = loginResponse.data;
    console.log('✅ Login successful!');
    console.log(`   Driver ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);

    // Step 2: Get available deliveries
    console.log('\n2️⃣ Fetching available deliveries...');
    const deliveriesResponse = await axios.get(
      `${BASE_URL}/api/v1/drivers/${user.id}/available-deliveries`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          lat: 36.8065,  // Tunis coordinates
          lng: 10.1815,
          radius_km: 10
        }
      }
    );

    const deliveries = deliveriesResponse.data;
    console.log(`✅ Found ${deliveries.length} available deliveries!\n`);

    if (deliveries.length === 0) {
      console.log('⚠️  No deliveries found within 10km radius.');
      console.log('   Make sure test orders were created with CONFIRMED status.');
      return;
    }

    // Display each delivery
    deliveries.forEach((delivery, index) => {
      console.log(`📦 Delivery ${index + 1}:`);
      console.log(`   Order ID: ${delivery.id}`);
      console.log(`   Tracking: ${delivery.trackingNumber}`);
      console.log(`   Status: ${delivery.status}`);
      console.log(`   Total: $${delivery.totalAmount}`);
      console.log(`   Customer: ${delivery.userId}`);
      console.log(`   Destination: ${delivery.deliveryAddress?.street || 'N/A'}`);
      console.log(`   Store Location: (${delivery.storeLat}, ${delivery.storeLon})`);
      console.log(`   Items: ${delivery.items?.length || 0}`);
      console.log('');
    });

    // Step 3: Test accepting a delivery (optional - commented out)
    /*
    if (deliveries.length > 0) {
      console.log('\n3️⃣ Testing accept delivery...');
      const orderId = deliveries[0].id;
      
      const acceptResponse = await axios.post(
        `${BASE_URL}/api/v1/drivers/${user.id}/accept-delivery`,
        { orderId },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('✅ Delivery accepted!');
      console.log(`   Order ID: ${acceptResponse.data.id}`);
      console.log(`   New Status: ${acceptResponse.data.status}`);
    }
    */

    console.log('=' .repeat(60));
    console.log('\n✅ All tests passed! The API is working correctly.');
    console.log('\n💡 If you can\'t see deliveries in the app:');
    console.log('   1. Check if the app is making the API call');
    console.log('   2. Check for authentication token issues');
    console.log('   3. Check app logs for errors');
    console.log('   4. Verify the driver user ID matches');

  } catch (error) {
    console.error('\n❌ Error during test:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }
  }
}

testDriverWorkflow();
