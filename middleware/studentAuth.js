const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const studentAuth = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'No authorization token found' });
        }

        const token = authHeader.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Invalid authorization format' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || !decoded.studentId) {
            return res.status(401).json({ message: 'Invalid token format' });
        }

        // Find student
        const student = await Student.findOne({ _id: decoded.studentId });
        if (!student) {
            return res.status(401).json({ message: 'Student not found' });
        }

        // Attach student and token to request
        req.token = token;
        req.student = student;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        res.status(401).json({ message: 'Please authenticate as a student' });
    }
};

module.exports = studentAuth;
