const { AppDataSource } = require('./src/config/data-source');
const { User } = require('./src/entities/User');
const { Address } = require('./src/entities/Address');

async function checkStoreAddress() {
    try {
        await AppDataSource.initialize();
        const userRepo = AppDataSource.getRepository(User);
        const addressRepo = AppDataSource.getRepository(Address);

        const store = await userRepo.findOne({
            where: { name: 'khentit moahmed' },
            relations: ['addresses']
        });

        if (store) {
            console.log(`Store: ${store.name} (id: ${store.id})`);
            console.log(`Addresses in relation: ${store.addresses.length}`);

            const directAddresses = await addressRepo.find({
                where: { userId: store.id }
            });
            console.log(`Direct addresses query: ${directAddresses.length}`);
            directAddresses.forEach(a => {
                console.log(`- ${a.street}, ${a.city} (isDefault: ${a.isDefault})`);
            });
        } else {
            console.log('Store not found');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkStoreAddress();
