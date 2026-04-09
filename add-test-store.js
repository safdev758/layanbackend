const { AppDataSource } = require('./src/config/data-source');
const { User } = require('./src/entities/User');
const { Address } = require('./src/entities/Address');
const bcrypt = require('bcryptjs');

async function addTestStore() {
    try {
        await AppDataSource.initialize();
        const userRepo = AppDataSource.getRepository(User);
        const addressRepo = AppDataSource.getRepository(Address);

        const email = 'teststore@layan.com';
        let store = await userRepo.findOne({ where: { email } });

        if (store) {
            console.log('Test store already exists, updating location...');
        } else {
            console.log('Creating new test store...');
            store = userRepo.create({
                name: 'Near User Market',
                email: email,
                password: await bcrypt.hash('password123', 10),
                role: 'SUPERMARKET',
                phone: '0000000000',
                status: 'ACTIVE',
                locationVerified: true
            });
        }

        // Test coordinates near user
        store.latitude = 35.215;
        store.longitude = -0.649;
        await userRepo.save(store);

        // Add address
        const address = addressRepo.create({
            user: store,
            street: '123 Nearby St',
            city: 'Tlemcen',
            state: 'Tlemcen',
            zipCode: '13000',
            country: 'Algeria',
            isDefault: true
        });
        await addressRepo.save(address);

        console.log('Test store added/updated successfully at 35.215, -0.649');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addTestStore();
