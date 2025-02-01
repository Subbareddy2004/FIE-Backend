const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const studentAuth = require('../middleware/studentAuth');

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

        // Return user data along with token
        res.status(201).json({
            token,
            _id: student._id,
            name: student.name,
            email: student.email,
            college: student.college,
            role: 'student'
        });
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

        res.json({
            token,
            _id: student._id,
            name: student.name,
            email: student.email,
            college: student.college,
            role: 'student'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get student profile
router.get('/profile', studentAuth, async (req, res) => {
    try {
        console.log('Fetching student profile for ID:', req.student._id);
        const student = await Student.findById(req.student._id)
            .select('-password')
            .populate({
                path: 'registeredHackathons.hackathonId',
                model: 'Event',
                select: 'title description startDate endDate venue status entryFee'
            })
            .populate({
                path: 'registeredHackathons.teamId',
                model: 'Team',
                select: 'teamName members paymentStatus'
            });

        if (!student) {
            console.error('Student not found:', req.student._id);
            return res.status(404).json({ message: 'Student not found' });
        }

        console.log('Raw student data:', JSON.stringify(student, null, 2));

        // Transform the data to include all necessary information
        const transformedStudent = {
            _id: student._id,
            name: student.name,
            email: student.email,
            college: student.college,
            registeredHackathons: student.registeredHackathons
                .filter(reg => reg.hackathonId && reg.teamId) // Only include valid registrations
                .map(reg => ({
                    _id: reg._id,
                    hackathonId: reg.hackathonId._id,
                    teamId: reg.teamId._id,
                    title: reg.hackathonId.title,
                    description: reg.hackathonId.description,
                    startDate: reg.hackathonId.startDate,
                    endDate: reg.hackathonId.endDate,
                    venue: reg.hackathonId.venue,
                    status: reg.hackathonId.status,
                    entryFee: reg.hackathonId.entryFee,
                    teamName: reg.teamName,
                    teamMembers: reg.teamMembers,
                    role: reg.role,
                    submissionDate: reg.submissionDate,
                    paymentStatus: reg.teamId.paymentStatus
                }))
        };

        console.log('Transformed student data:', JSON.stringify(transformedStudent, null, 2));
        res.json(transformedStudent);
    } catch (error) {
        console.error('Error fetching student profile:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update hackathon registration
router.put('/hackathon/:hackathonId', studentAuth, async (req, res) => {
    try {
        const { teamName, teamMembers, projectDescription } = req.body;
        const student = await Student.findById(req.student._id);
        
        const registrationIndex = student.registeredHackathons.findIndex(
            reg => reg.hackathonId.toString() === req.params.hackathonId
        );

        if (registrationIndex === -1) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        // Update the registration
        if (teamName) {
            student.registeredHackathons[registrationIndex].teamName = teamName;
        }
        if (teamMembers) {
            student.registeredHackathons[registrationIndex].teamMembers = teamMembers;
        }
        if (projectDescription) {
            student.registeredHackathons[registrationIndex].projectDescription = projectDescription;
        }

        await student.save();

        // Get updated student data with populated fields
        const updatedStudent = await Student.findById(req.student._id)
            .select('-password')
            .populate({
                path: 'registeredHackathons.hackathonId',
                model: 'Event',
                select: 'title description startDate endDate venue status entryFee'
            })
            .populate({
                path: 'registeredHackathons.teamId',
                model: 'Team',
                select: 'teamName members paymentStatus'
            });

        // Return the updated registration
        const updatedRegistration = updatedStudent.registeredHackathons[registrationIndex];
        res.json({
            message: 'Registration updated successfully',
            registration: {
                _id: updatedRegistration._id,
                hackathonId: updatedRegistration.hackathonId._id,
                teamId: updatedRegistration.teamId._id,
                title: updatedRegistration.hackathonId.title,
                description: updatedRegistration.hackathonId.description,
                startDate: updatedRegistration.hackathonId.startDate,
                endDate: updatedRegistration.hackathonId.endDate,
                venue: updatedRegistration.hackathonId.venue,
                status: updatedRegistration.hackathonId.status,
                entryFee: updatedRegistration.hackathonId.entryFee,
                teamName: updatedRegistration.teamName,
                teamMembers: updatedRegistration.teamMembers,
                role: updatedRegistration.role,
                submissionDate: updatedRegistration.submissionDate,
                paymentStatus: updatedRegistration.teamId.paymentStatus,
                projectDescription: updatedRegistration.projectDescription
            }
        });
    } catch (error) {
        console.error('Error updating registration:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
