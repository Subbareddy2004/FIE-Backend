const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Team = require('../models/Team');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

// Get teams for an event (protected route)
router.get('/event/:eventId', auth, async (req, res) => {
    try {
        const teams = await Team.find({ event: req.params.eventId })
            .sort({ createdAt: -1 });
        res.json({ teams: teams || [] });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Error fetching teams', error: error.message });
    }
});

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
        
        if (currentDate > deadlineDate) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }

        // Check if event has reached max teams
        const existingTeamsCount = await Team.countDocuments({ event: req.params.eventId });
        if (existingTeamsCount >= event.maxTeams) {
            return res.status(400).json({ message: 'Event has reached maximum team capacity' });
        }

        // Create and save the team
        const team = new Team({
            event: req.params.eventId,
            name: req.body.name,
            members: req.body.members
        });

        await team.save();
        
        // Update event's registered teams count
        await Event.findByIdAndUpdate(req.params.eventId, {
            $inc: { registeredTeams: 1 }
        });

        res.status(201).json({ message: 'Team registered successfully', team });
    } catch (error) {
        console.error('Error registering team:', error);
        res.status(500).json({ message: 'Error registering team', error: error.message });
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
