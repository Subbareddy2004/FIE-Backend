const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Team = require('../models/Team');

// Get event details by share link
router.get('/:shareLink', async (req, res) => {
    try {
        const event = await Event.findOne({ 
            shareLink: req.params.shareLink,
            isPublic: true 
        }).select('-paymentDetails');

        if (!event) {
            return res.status(404).json({ message: 'Event not found or not public' });
        }

        // Get number of available slots
        const registeredTeams = await Team.countDocuments({ event: event._id });
        const availableSlots = event.maxTeams - registeredTeams;

        res.json({
            ...event.toObject(),
            availableSlots,
            isRegistrationOpen: event.isRegistrationOpen
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Register team for public event
router.post('/:shareLink/register', async (req, res) => {
    try {
        const event = await Event.findOne({ 
            shareLink: req.params.shareLink,
            isPublic: true 
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found or not public' });
        }

        if (!event.isRegistrationOpen) {
            return res.status(400).json({ message: 'Registration is closed' });
        }

        // Check if registration deadline has passed
        const currentDate = new Date();
        const deadlineDate = new Date(event.registrationDeadline);
        if (currentDate > deadlineDate) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }

        // Check if slots are available
        const registeredTeams = await Team.countDocuments({ event: event._id });
        if (registeredTeams >= event.maxTeams) {
            return res.status(400).json({ message: 'No slots available' });
        }

        // Validate team size
        const { teamName, members } = req.body;
        if (!teamName || !members || !Array.isArray(members)) {
            return res.status(400).json({ message: 'Invalid team data' });
        }

        if (members.length < event.teamSize.min || members.length > event.teamSize.max) {
            return res.status(400).json({ 
                message: `Team size must be between ${event.teamSize.min} and ${event.teamSize.max} members` 
            });
        }

        // Create new team
        const team = new Team({
            name: teamName,
            event: event._id,
            members: members,
            registrationDate: new Date()
        });

        await team.save();

        // Update event's registered teams count
        event.registeredTeams += 1;
        await event.save();

        res.status(201).json({ 
            message: 'Team registered successfully',
            team: team
        });
    } catch (error) {
        console.error('Error registering team:', error);
        res.status(500).json({ 
            message: 'Failed to register team',
            error: error.message
        });
    }
});

module.exports = router;
