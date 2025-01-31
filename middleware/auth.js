const jwt = require('jsonwebtoken');
const Manager = require('../models/Manager');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get manager from token
        const manager = await Manager.findById(decoded.id).select('-password');
        if (!manager) {
            return res.status(401).json({ message: 'Token is not valid' });
        }

        // Set both user and manager for backward compatibility
        req.user = manager;
        req.manager = manager;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = auth;
