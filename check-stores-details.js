const { AppDataSource } = require('./src/config/data-source');
const { User } = require('./src/entities/User');

async function checkStores() {
    try {
        await AppDataSource.initialize();
        const userRepo = AppDataSource.getRepository(User);
        const stores = await userRepo.find({
            where: { role: 'SUPERMARKET' }
        });

        console.log('Stores found:', stores.length);
        stores.forEach(s => {
            console.log(`- ${s.name} (${s.email}): status=${s.status}, locationVerified=${s.locationVerified}, lat=${s.latitude}, lon=${s.longitude}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkStores();
