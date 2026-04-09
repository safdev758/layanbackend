const { AppDataSource } = require('./src/config/data-source');
const { getNearbyStores } = require('./src/services/driverLocationService');

async function testNearbyStores() {
    try {
        await AppDataSource.initialize();

        // Test with khentit moahmed's location (35.2139833, -0.6472209)
        const lat = 35.2139833;
        const lon = -0.6472209;

        console.log(`Searching for stores near: ${lat}, ${lon}`);
        const result = await getNearbyStores(lat, lon, 50, 10);

        console.log('Stores found:', result.totalStores);
        result.stores.forEach(s => {
            console.log(`- ${s.name}: dist=${s.distance.toFixed(2)}km, address=${s.address}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testNearbyStores();
