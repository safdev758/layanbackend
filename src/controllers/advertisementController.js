const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Advertisement } = require('../entities/Advertisement');
const { randomUUID } = require('crypto');

function isMissingRelationError(error) {
    return error && error.code === '42P01';
}

async function ensureAdvertisementsTableExists() {
    await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS advertisements (
            id UUID PRIMARY KEY,
            "imageBase64" TEXT NOT NULL,
            description VARCHAR(500) NOT NULL,
            "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

// Create a new advertisement (Admin)
const createAd = asyncHandler(async (req, res) => {
    const { imageBase64, description } = req.body;

    if (!imageBase64 || !description) {
        return res.status(400).json({ message: 'imageBase64 and description are required' });
    }

    let saved;
    try {
        const repo = AppDataSource.getRepository(Advertisement);
        const ad = repo.create({ id: randomUUID(), imageBase64, description, isActive: true });
        saved = await repo.save(ad);
    } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        await ensureAdvertisementsTableExists();
        const repo = AppDataSource.getRepository(Advertisement);
        const ad = repo.create({ id: randomUUID(), imageBase64, description, isActive: true });
        saved = await repo.save(ad);
    }

    res.status(201).json(saved);
});

// List all advertisements (Admin)
const listAds = asyncHandler(async (req, res) => {
    let ads = [];
    try {
        const repo = AppDataSource.getRepository(Advertisement);
        ads = await repo.find({ order: { createdAt: 'DESC' } });
    } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        try {
            await ensureAdvertisementsTableExists();
        } catch (createError) {
            console.error('Failed to auto-create advertisements table:', createError.message || createError);
        }
    }

    res.json({ advertisements: ads });
});

// Toggle active status (Admin)
const toggleAd = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let updated;
    try {
        const repo = AppDataSource.getRepository(Advertisement);
        const ad = await repo.findOne({ where: { id } });
        if (!ad) return res.status(404).json({ message: 'Advertisement not found' });

        ad.isActive = !ad.isActive;
        ad.updatedAt = new Date();
        updated = await repo.save(ad);
    } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        await ensureAdvertisementsTableExists();
        return res.status(503).json({ message: 'Advertisement storage is initializing. Please retry.' });
    }

    res.json(updated);
});

// Delete advertisement (Admin)
const deleteAd = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const repo = AppDataSource.getRepository(Advertisement);
        const ad = await repo.findOne({ where: { id } });
        if (!ad) return res.status(404).json({ message: 'Advertisement not found' });

        await repo.remove(ad);
    } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        await ensureAdvertisementsTableExists();
        return res.status(503).json({ message: 'Advertisement storage is initializing. Please retry.' });
    }

    res.json({ message: 'Advertisement deleted' });
});

// Get the active advertisement (Public - for mobile app)
const getActiveAd = asyncHandler(async (req, res) => {
    let ad = null;
    try {
        const repo = AppDataSource.getRepository(Advertisement);
        ad = await repo.findOne({
            where: { isActive: true },
            order: { createdAt: 'DESC' }
        });
    } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        try {
            await ensureAdvertisementsTableExists();
        } catch (createError) {
            console.error('Failed to auto-create advertisements table:', createError.message || createError);
        }
    }

    if (!ad) {
        return res.json({ advertisement: null });
    }

    res.json({ advertisement: ad });
});

// Get all active advertisements (Public - for mobile app hero carousel)
const getActiveAds = asyncHandler(async (req, res) => {
    let ads = [];
    try {
        const repo = AppDataSource.getRepository(Advertisement);
        ads = await repo.find({
            where: { isActive: true },
            order: { createdAt: 'DESC' }
        });
    } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        try {
            await ensureAdvertisementsTableExists();
        } catch (createError) {
            console.error('Failed to auto-create advertisements table:', createError.message || createError);
        }
    }

    res.json({ advertisements: ads });
});

module.exports = { createAd, listAds, toggleAd, deleteAd, getActiveAd, getActiveAds };
