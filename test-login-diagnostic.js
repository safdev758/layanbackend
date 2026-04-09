const { AppDataSource } = require('./src/config/data-source');
const { User } = require('./src/entities/User');
const bcrypt = require('bcryptjs');

async function testLogin() {
    try {
        await AppDataSource.initialize();
        console.log('✅ Connected to database');

        const email = 'admin@layan.com';
        const password = 'Admin@123';

        const repo = AppDataSource.getRepository(User);

        console.log(`🔍 Looking for user: ${email}`);
        try {
            const user = await repo.findOne({ where: { email } });

            if (!user) {
                console.log('❌ User not found');
                return;
            }

            console.log('✅ User found:', {
                id: user.id,
                email: user.email,
                role: user.role,
                passwordHash: !!user.passwordHash,
                phoneVerified: user.phoneVerified
            });

            const match = await bcrypt.compare(password, user.passwordHash);
            if (match) {
                console.log('✅ Password matches!');
            } else {
                console.log('❌ Password DOES NOT match');
            }
        } catch (dbError) {
            console.error('❌ Database error during findOne:', dbError);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

testLogin();
