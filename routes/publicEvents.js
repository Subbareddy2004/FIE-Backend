const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Team = require('../models/Team');
const Student = require('../models/Student'); // Assuming Student model is defined in '../models/Student'

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
        const { teamName, members, upiTransactionId } = req.body;

        // Validate request body
        if (!teamName || !members || !Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        // Ensure at least one team member is marked as leader
        const hasLeader = members.some(member => member.isLeader);
        if (!hasLeader) {
            return res.status(400).json({ message: 'Team must have a leader' });
        }

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
        if (event.teams.length >= event.maxTeams) {
            return res.status(400).json({ message: 'No slots available' });
        }

        // Check team size constraints
        if (members.length < event.minTeamSize || members.length > event.maxTeamSize) {
            return res.status(400).json({ 
                message: `Team size must be between ${event.minTeamSize} and ${event.maxTeamSize} members` 
            });
        }

        // Check if any team member is already registered
        const memberEmails = members.map(m => m.email);
        const existingTeams = await Team.find({ 
            event: event._id,
            'members.email': { $in: memberEmails }
        });

        if (existingTeams.length > 0) {
            return res.status(400).json({ 
                message: 'One or more team members are already registered for this event' 
            });
        }

        // Create a new team
        const team = new Team({
            teamName,
            event: event._id,
            members: members.map(member => ({
                name: member.name,
                email: member.email,
                registerNumber: member.registerNumber,
                mobileNumber: member.mobileNumber,
                isLeader: member.isLeader
            })),
            paymentStatus: event.entryFee > 0 ? 'pending' : 'not_required',
            upiTransactionId: event.entryFee > 0 ? upiTransactionId : undefined,
            registrationDate: new Date()
        });

        await team.save();

        // Update event with the new team
        event.teams.push({
            teamId: team._id,
            teamName,
            members: members.map(member => ({
                name: member.name,
                email: member.email,
                role: member.isLeader ? 'leader' : 'member'
            })),
            paymentStatus: event.entryFee > 0 ? 'pending' : 'not_required',
            upiTransactionId: event.entryFee > 0 ? upiTransactionId : undefined
        });

        await event.save();

        console.log('Updating student profiles for team registration...');
        const studentUpdates = [];

        for (const member of members) {
            try {
                console.log(`Attempting to update student profile for email: ${member.email}`);
                const student = await Student.findOne({ email: member.email });
                
                if (!student) {
                    console.error(`No student found with email: ${member.email}`);
                    continue;
                }

                console.log(`Found student: ${student.name} (${student.email})`);
                
                // Create the registration object
                const registration = {
                    hackathonId: event._id,
                    teamId: team._id,
                    teamName,
                    teamMembers: members.map(m => m.name),
                    role: member.isLeader ? 'leader' : 'member',
                    submissionDate: new Date()
                };

                // Check if already registered
                const alreadyRegistered = student.registeredHackathons.some(
                    reg => reg.hackathonId.toString() === event._id.toString()
                );

                if (alreadyRegistered) {
                    console.log(`Student ${student.email} is already registered for this event`);
                    continue;
                }

                // Add the new registration
                student.registeredHackathons.push(registration);
                
                // Save the student document
                const savedStudent = await student.save();
                console.log(`Successfully updated student profile for ${savedStudent.email}`);
                console.log('Updated registeredHackathons:', savedStudent.registeredHackathons);
                
                studentUpdates.push(savedStudent);
            } catch (error) {
                console.error(`Error updating student ${member.email}:`, error);
                throw error; // Propagate the error to trigger a rollback
            }
        }

        if (studentUpdates.length === 0) {
            throw new Error('No student profiles were updated');
        }

        res.status(201).json({
            message: 'Team registered successfully',
            teamId: team._id,
            eventId: event._id,
            teamName,
            paymentStatus: team.paymentStatus
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: 'Error registering team',
            error: error.message 
        });
    }
});

module.exports = router;
