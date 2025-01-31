const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const { sendRegistrationPendingEmail } = require('../services/emailService');
const json2csv = require('json2csv').parse;
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

// Create event - must come before parameterized routes
router.post('/create', auth, async (req, res) => {
    try {
        const event = new Event({
            ...req.body,
            manager: req.user._id,
            teams: []
        });
        await event.save();
        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get manager's events and dashboard stats
router.get('/manager', auth, async (req, res) => {
    try {
        // Get all events for the manager
        const events = await Event.find({ manager: req.user._id })
            .sort({ createdAt: -1 });

        // Get team counts for each event
        const eventsWithTeams = await Promise.all(events.map(async (event) => {
            const teamCount = await Team.countDocuments({ event: event._id });
            return {
                ...event.toObject(),
                teams: await Team.find({ event: event._id }).select('_id'),
                teamsCount: teamCount
            };
        }));
        
        // Calculate stats
        const now = new Date();
        const stats = {
            totalEvents: events.length,
            activeEvents: events.filter(event => 
                new Date(event.startDate) <= now && new Date(event.endDate) >= now
            ).length,
            upcomingEvents: events.filter(event => new Date(event.startDate) > now).length,
            completedEvents: events.filter(event => new Date(event.endDate) < now).length
        };

        res.json({ events: eventsWithTeams, stats });
    } catch (error) {
        console.error('Error fetching manager events:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all events with filters
router.get('/', async (req, res) => {
    try {
        const { status, department } = req.query;
        let query = {};
        
        if (status) query.status = status;
        if (department) query.departments = department;

        const events = await Event.find(query)
            .populate('manager', 'name organization')
            .sort('-createdAt');
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get event teams
router.get('/teams/:eventId', auth, async (req, res) => {
    try {
        const teams = await Team.find({ event: req.params.eventId })
            .populate('members', 'name email');
        res.json(teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export event data as CSV
router.get('/export-csv/:eventId', auth, async (req, res) => {
    try {
        const event = await Event.findOne({
            _id: req.params.eventId,
            manager: req.user._id
        });
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const teams = await Team.find({ event: req.params.eventId })
            .populate('members', 'name email college department');

        const fields = ['Team Name', 'Members', 'Emails', 'College', 'Department', 'Registration Date'];
        const data = teams.map(team => ({
            'Team Name': team.name,
            'Members': team.members.map(m => m.name).join(', '),
            'Emails': team.members.map(m => m.email).join(', '),
            'College': team.members[0]?.college || 'N/A',
            'Department': team.members[0]?.department || 'N/A',
            'Registration Date': team.createdAt.toLocaleDateString()
        }));

        const csv = json2csv(data, { fields });
        res.header('Content-Type', 'text/csv');
        res.attachment(`${event.title}-teams.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get single event - must come after all other GET routes
router.get('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Get teams for this event
        const teams = await Team.find({ event: event._id });
        const eventWithTeams = {
            ...event.toObject(),
            teams,
            teamsCount: teams.length
        };

        res.json(eventWithTeams);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update event
router.put('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if the event belongs to the manager
        if (event.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this event' });
        }

        // Validate required fields
        const requiredFields = ['title', 'description', 'startDate', 'endDate', 'registrationDeadline', 'venue', 'minTeamSize', 'maxTeamSize', 'maxTeams', 'departments'];
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({ message: `${field} is required` });
            }
        }

        // Validate venue fields
        const venueFields = ['name', 'address', 'city', 'state', 'country'];
        for (const field of venueFields) {
            if (!req.body.venue[field]) {
                return res.status(400).json({ message: `venue.${field} is required` });
            }
        }

        // Validate payment details if entry fee is set
        if (req.body.entryFee > 0 && !req.body.paymentDetails?.upiId) {
            return res.status(400).json({ message: 'UPI ID is required when entry fee is set' });
        }

        // Update event fields
        const updateFields = [
            'title', 'description', 'startDate', 'endDate', 'registrationDeadline',
            'venue', 'minTeamSize', 'maxTeamSize', 'maxTeams', 'entryFee',
            'paymentDetails', 'whatsappLink', 'rules', 'departments', 'skills',
            'prizes', 'status', 'image'
        ];

        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                event[field] = req.body[field];
            }
        });

        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        // Get teams count
        const teams = await Team.find({ event: updatedEvent._id });
        const eventWithTeams = {
            ...updatedEvent.toObject(),
            teams,
            teamsCount: teams.length
        };

        res.json(eventWithTeams);
    } catch (error) {
        console.error('Error updating event:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: 'Validation error', 
                errors: Object.values(error.errors).map(err => err.message)
            });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if the event belongs to the manager
        if (event.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this event' });
        }

        // Delete the event
        await Event.findByIdAndDelete(req.params.id);
        
        // Delete associated teams
        await Team.deleteMany({ event: req.params.id });
        
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Generate event certificate
router.get('/:eventId/certificate/:teamId', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        const team = await Team.findById(req.params.teamId)
            .populate('members', 'name');

        if (!event || !team) {
            return res.status(404).json({ message: 'Event or team not found' });
        }

        const doc = new PDFDocument({
            layout: 'landscape',
            size: 'A4'
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificate-${team._id}.pdf`);
        doc.pipe(res);

        // Add certificate content
        doc.fontSize(25)
            .text('Certificate of Participation', 100, 80, { align: 'center' });

        doc.fontSize(15)
            .text(`This is to certify that`, 100, 160, { align: 'center' });

        team.members.forEach((member, index) => {
            doc.fontSize(20)
                .text(member.name, 100, 200 + (index * 30), { align: 'center' });
        });

        doc.fontSize(15)
            .text(`has successfully participated in`, 100, 280, { align: 'center' })
            .fontSize(20)
            .text(event.title, 100, 320, { align: 'center' })
            .fontSize(15)
            .text(`held from ${new Date(event.startDate).toLocaleDateString()} to ${new Date(event.endDate).toLocaleDateString()}`, 100, 360, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Error generating certificate:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all published events for public view
router.get('/public', async (req, res) => {
    try {
        const events = await Event.find({ status: { $ne: 'draft' } })
            .sort({ startDate: 1 })
            .select('-manager');
        res.json(events);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
