const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Team = require('../models/Team');

// Get all published events
router.get('/', async (req, res) => {
    try {
        const currentDate = new Date();
        
        // Get all events that are not drafts and registration hasn't ended
        const events = await Event.find({
            status: { $ne: 'draft' },
            registrationDeadline: { $gt: currentDate }
        })
        .populate('manager', 'name organization')
        .sort({ startDate: 1 })
        .select('-paymentDetails');

        // Get registration status for each event
        const eventsWithStatus = await Promise.all(events.map(async (event) => {
            const registeredTeams = await Team.countDocuments({ event: event._id });
            const availableSlots = event.maxTeams - registeredTeams;
            
            return {
                ...event.toObject(),
                registeredTeams,
                availableSlots,
                isRegistrationOpen: event.isRegistrationOpen && 
                                  new Date(event.registrationDeadline) > currentDate &&
                                  registeredTeams < event.maxTeams
            };
        }));

        res.json(eventsWithStatus);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get event details by ID or share link
router.get('/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const currentDate = new Date();

        // Try to find by ID first (if it's a valid ObjectId)
        let event;
        if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
            event = await Event.findById(identifier)
                .populate('manager', 'name organization');
        }

        // If not found by ID, try to find by shareLink
        if (!event) {
            event = await Event.findOne({ shareLink: identifier })
                .populate('manager', 'name organization');
        }

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Get registration status
        const registeredTeams = await Team.countDocuments({ event: event._id });
        const eventWithStatus = {
            ...event.toObject(),
            registeredTeams,
            availableSlots: event.maxTeams - registeredTeams,
            isRegistrationOpen: event.isRegistrationOpen && 
                              new Date(event.registrationDeadline) > currentDate &&
                              registeredTeams < event.maxTeams
        };

        res.json(eventWithStatus);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ 
            message: 'Error fetching event',
            error: error.message 
        });
    }
});

// Register team for public event
router.post('/:identifier/register', async (req, res) => {
    try {
        const { identifier } = req.params;
        let event;

        // Try to find by ID first (if it's a valid ObjectId)
        if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
            event = await Event.findById(identifier);
        }

        // If not found by ID, try to find by shareLink
        if (!event) {
            event = await Event.findOne({ shareLink: identifier });
        }

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if registration is open
        const currentDate = new Date();
        if (!event.isRegistrationOpen || currentDate > new Date(event.registrationDeadline)) {
            return res.status(400).json({ message: 'Registration is closed for this event' });
        }

        // Check if slots are available
        const registeredTeams = await Team.countDocuments({ event: event._id });
        if (registeredTeams >= event.maxTeams) {
            return res.status(400).json({ message: 'No slots available' });
        }

        // Validate team data
        const { teamName, members, upiTransactionId } = req.body;
        if (!teamName || !members || !Array.isArray(members)) {
            return res.status(400).json({ message: 'Invalid team data' });
        }

        // Validate team size
        const minTeamSize = event.minTeamSize || 1;
        const maxTeamSize = event.maxTeamSize || 4;
        if (members.length < minTeamSize || members.length > maxTeamSize) {
            return res.status(400).json({ 
                message: `Team size must be between ${minTeamSize} and ${maxTeamSize} members` 
            });
        }

        // Validate payment if required
        if (event.entryFee > 0 && !upiTransactionId) {
            return res.status(400).json({ message: 'Payment details are required' });
        }

        // Create new team
        const team = new Team({
            name: teamName,
            event: event._id,
            members: members.map(member => ({
                name: member.name,
                email: member.email,
                registerNumber: member.registerNumber,
                mobileNumber: member.mobileNumber,
                isLeader: member.isLeader
            })),
            paymentStatus: event.entryFee > 0 ? 'pending' : 'not_required',
            upiTransactionId,
            registrationDate: new Date()
        });

        await team.save();

        res.status(201).json({ 
            message: 'Team registered successfully',
            team: {
                id: team._id,
                name: team.name,
                members: team.members,
                paymentStatus: team.paymentStatus
            }
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
