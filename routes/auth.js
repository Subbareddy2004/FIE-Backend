const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Manager = require('../models/Manager');

// Manager Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, organization, department, role } = req.body;

        // Validate required fields
        const requiredFields = ['name', 'email', 'password', 'organization', 'department', 'role'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            console.log('Missing required fields:', missingFields);
            return res.status(400).json({ 
                message: 'Missing required fields', 
                fields: missingFields 
            });
        }

        // Validate role
        const validRoles = ['professor', 'hod', 'coordinator', 'other'];
        if (!validRoles.includes(role)) {
            console.log('Invalid role:', role);
            return res.status(400).json({ 
                message: 'Invalid role. Must be one of: professor, hod, coordinator, other' 
            });
        }

        // Check if manager already exists
        const existingManager = await Manager.findOne({ email });
        if (existingManager) {
            console.log('Manager already exists:', email);
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create new manager
        const manager = new Manager({
            name,
            email,
            password,
            organization,
            department,
            role
        });

        // Save the manager
        await manager.save();
        console.log('Manager created successfully:', email);

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
            department: manager.department,
            role: manager.role,
            token
        });
    } catch (error) {
        console.error('Registration error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: Object.values(error.errors).map(err => err.message)
            });
        }
        
        res.status(500).json({ 
            message: 'Server error during registration',
            error: error.message
        });
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
            department: manager.department,
            role: manager.role,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

module.exports = router;
