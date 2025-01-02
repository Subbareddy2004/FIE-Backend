const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Manager = require('../models/Manager');

// Manager Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, organization } = req.body;

        // Check if manager already exists
        const existingManager = await Manager.findOne({ email });
        if (existingManager) {
            return res.status(400).json({ message: 'Manager already exists' });
        }

        // Create new manager
        const manager = await Manager.create({
            name,
            email,
            password,
            organization
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: manager._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            _id: manager._id,
            name: manager.name,
            email: manager.email,
            organization: manager.organization,
            token
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Manager Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find manager
        const manager = await Manager.findOne({ email });
        if (!manager) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await manager.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: manager._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            _id: manager._id,
            name: manager.name,
            email: manager.email,
            organization: manager.organization,
            token
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
