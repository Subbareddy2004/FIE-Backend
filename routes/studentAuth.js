const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const auth = require('../middleware/auth');

// Student Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, college } = req.body;
        
        // Check if student already exists
        let student = await Student.findOne({ email });
        if (student) {
            return res.status(400).json({ message: 'Student already exists' });
        }

        // Create new student
        student = new Student({
            name,
            email,
            password,
            college
        });

        await student.save();

        // Create JWT token
        const token = jwt.sign(
            { studentId: student._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Student Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if student exists
        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await student.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
            { studentId: student._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get student profile
router.get('/profile', auth, async (req, res) => {
    try {
        const student = await Student.findById(req.user.studentId)
            .select('-password')
            .populate('registeredHackathons.hackathonId');
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update hackathon registration
router.put('/hackathon/:hackathonId', auth, async (req, res) => {
    try {
        const { teamName, teamMembers, projectDescription } = req.body;
        const student = await Student.findById(req.user.studentId);
        
        const registrationIndex = student.registeredHackathons.findIndex(
            h => h.hackathonId.toString() === req.params.hackathonId
        );

        if (registrationIndex === -1) {
            return res.status(404).json({ message: 'Hackathon registration not found' });
        }

        student.registeredHackathons[registrationIndex] = {
            ...student.registeredHackathons[registrationIndex],
            teamName,
            teamMembers,
            projectDescription,
        };

        await student.save();
        res.json(student.registeredHackathons[registrationIndex]);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
