const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Team = require('../models/Team');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

// Register team for an event (public route)
router.post('/register/:eventId', async (req, res) => {
    try {
        console.log('Registration request received:', {
            eventId: req.params.eventId,
            body: req.body
        });

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
            return res.status(400).json({ message: 'Invalid event ID format' });
        }

        const event = await Event.findById(req.params.eventId);
        console.log('Event found:', event);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if registration is still open
        const currentDate = new Date();
        const deadlineDate = new Date(event.registrationDeadline);
        
        console.log('Date check:', {
            current: currentDate,
            deadline: deadlineDate
        });

        if (currentDate > deadlineDate) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }

        // Check if event has reached max teams
        if (event.registeredTeams >= event.maxTeams) {
            return res.status(400).json({ message: 'Event has reached maximum team capacity' });
        }

        // Validate request body
        const { teamName, members } = req.body;
        
        console.log('Validating team data:', {
            teamName,
            memberCount: members?.length
        });

        if (!teamName || !members || !Array.isArray(members)) {
            return res.status(400).json({ 
                message: 'Invalid request data',
                details: {
                    teamName: !teamName ? 'Team name is required' : null,
                    members: !members ? 'Members array is required' : (!Array.isArray(members) ? 'Members must be an array' : null)
                }
            });
        }

        // Check team size constraints
        if (members.length < event.teamSize.min || members.length > event.teamSize.max) {
            return res.status(400).json({ 
                message: `Team size must be between ${event.teamSize.min} and ${event.teamSize.max} members`,
                current: members.length
            });
        }

        // Validate team leader
        const hasLeader = members.some(member => member.isLeader);
        if (!hasLeader) {
            return res.status(400).json({ message: 'Team must have a leader' });
        }

        // Validate each member's data
        for (const [index, member] of members.entries()) {
            if (!member.name || !member.email || !member.registerNumber || !member.mobileNumber) {
                return res.status(400).json({ 
                    message: 'All member fields are required',
                    memberIndex: index,
                    missing: {
                        name: !member.name,
                        email: !member.email,
                        registerNumber: !member.registerNumber,
                        mobileNumber: !member.mobileNumber
                    }
                });
            }
        }

        console.log('Creating team...');

        // Create team
        const team = await Team.create({
            name: teamName,
            members: members,
            event: req.params.eventId,
            registrationStatus: 'confirmed'
        });

        console.log('Team created:', team);

        // Update event registered teams count
        await Event.findByIdAndUpdate(req.params.eventId, {
            $inc: { registeredTeams: 1 }
        });

        console.log('Event updated with new team count');

        res.status(201).json({
            message: 'Team registered successfully',
            team: {
                id: team._id,
                name: team.name,
                members: team.members,
                registrationStatus: team.registrationStatus
            }
        });
    } catch (error) {
        console.error('Team registration error:', {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        
        res.status(500).json({ 
            message: 'Failed to register team',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get teams for an event (manager only)
router.get('/event/:eventId', auth, async (req, res) => {
    try {
        const teams = await Team.find({ event: req.params.eventId })
            .sort({ createdAt: -1 });

        res.json({
            message: 'Teams retrieved successfully',
            teams: teams.map(team => ({
                id: team._id,
                name: team.name,
                members: team.members,
                registrationStatus: team.registrationStatus,
                registeredAt: team.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ 
            message: 'Failed to fetch teams',
            error: error.message 
        });
    }
});

// Get teams for an event (manager only)
router.get('/event/:eventId', auth, async (req, res) => {
    try {
        const event = await Event.findOne({
            _id: req.params.eventId,
            manager: req.manager.id
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        const teams = await Team.find({ event: req.params.eventId })
            .sort('-createdAt');
        res.json(teams);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update team details (manager only)
router.put('/:teamId', auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const event = await Event.findOne({
            _id: team.event,
            manager: req.manager.id
        });

        if (!event) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Check team size constraints if updating members
        if (req.body.members) {
            if (req.body.members.length < event.teamSize.min || 
                req.body.members.length > event.teamSize.max) {
                return res.status(400).json({ 
                    message: `Team size must be between ${event.teamSize.min} and ${event.teamSize.max} members` 
                });
            }

            // Validate team leader
            const hasLeader = req.body.members.some(member => member.isLeader);
            if (!hasLeader) {
                return res.status(400).json({ message: 'Team must have a leader' });
            }
        }

        const updatedTeam = await Team.findByIdAndUpdate(
            req.params.teamId,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        res.json(updatedTeam);
    } catch (error) {
        res.status(400).json({ message: 'Invalid update data', error: error.message });
    }
});

// Delete team (manager only)
router.delete('/:teamId', auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const event = await Event.findOne({
            _id: team.event,
            manager: req.manager.id
        });

        if (!event) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        await Team.findByIdAndDelete(req.params.teamId);
        
        // Update event registered teams count
        await Event.findByIdAndUpdate(team.event, {
            $inc: { registeredTeams: -1 }
        });

        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export teams data as CSV
router.get('/:eventId/export/csv', auth, async (req, res) => {
    try {
        const event = await Event.findOne({
            _id: req.params.eventId,
            manager: req.manager.id
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        const teams = await Team.find({ event: req.params.eventId });
        const fields = ['name', 'members.name', 'members.email', 'members.registerNumber', 
                       'members.mobileNumber', 'members.isLeader', 'registrationStatus', 'createdAt'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(teams);

        res.header('Content-Type', 'text/csv');
        res.attachment(`${event.title}-teams.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export teams data as PDF
router.get('/:eventId/export/pdf', auth, async (req, res) => {
    try {
        const event = await Event.findOne({
            _id: req.params.eventId,
            manager: req.manager.id
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        const teams = await Team.find({ event: req.params.eventId });
        const doc = new PDFDocument();

        res.header('Content-Type', 'application/pdf');
        res.attachment(`${event.title}-teams.pdf`);
        doc.pipe(res);

        // Add event details
        doc.fontSize(20).text(event.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Total Teams: ${teams.length}`, { align: 'right' });
        doc.moveDown();

        // Add teams data
        teams.forEach((team, index) => {
            doc.fontSize(14).text(`Team ${index + 1}: ${team.name}`);
            doc.moveDown(0.5);
            team.members.forEach(member => {
                doc.fontSize(10).text(`${member.isLeader ? 'Leader: ' : 'Member: '} ${member.name}`);
                doc.fontSize(8).text(`Email: ${member.email}`);
                doc.fontSize(8).text(`Register Number: ${member.registerNumber}`);
                doc.fontSize(8).text(`Mobile: ${member.mobileNumber}`);
                doc.moveDown(0.5);
            });
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
