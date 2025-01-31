const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const studentAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const student = await Student.findOne({ _id: decoded.studentId });

        if (!student) {
            throw new Error();
        }

        req.token = token;
        req.student = student;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Please authenticate as a student' });
    }
};

module.exports = studentAuth;
