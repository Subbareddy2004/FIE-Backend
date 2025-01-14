const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const { sendRegistrationPendingEmail } = require('../services/emailService');
const json2csv = require('json2csv').parse;
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

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

// Get manager's events
router.get('/manager', auth, async (req, res) => {
    try {
        const events = await Event.find({ manager: req.manager.id })
            .populate('manager', 'name organization')
            .sort('-createdAt');
        res.json(events);
    } catch (error) {
        console.error('Error fetching manager events:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create new event
router.post('/', auth, async (req, res) => {
    try {
        const event = await Event.create({
            ...req.body,
            manager: req.manager.id
        });
        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(400).json({ 
            message: 'Invalid event data', 
            error: error.message 
        });
    }
});

// Get event by ID
router.get('/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        // Log the received ID for debugging
        console.log('Received event ID:', eventId);

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            console.log('Invalid event ID format:', eventId);
            return res.status(400).json({ message: 'Invalid event ID format' });
        }

        const event = await Event.findById(eventId)
            .populate('manager', 'name organization');
            
        if (!event) {
            console.log('Event not found for ID:', eventId);
            return res.status(404).json({ message: 'Event not found' });
        }

        // Log successful retrieval
        console.log('Event retrieved successfully:', event._id);
        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ 
            message: 'Error fetching event', 
            error: error.message 
        });
    }
});

// Update event
router.put('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findOne({ 
            _id: req.params.id,
            manager: req.manager.id 
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        // Check if trying to update after event has started
        if (new Date() > new Date(event.startDate) && 
            (req.body.startDate || req.body.endDate || req.body.teamSize)) {
            return res.status(400).json({ 
                message: 'Cannot modify core event details after event has started' 
            });
        }

        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        res.json(updatedEvent);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(400).json({ 
            message: 'Invalid update data', 
            error: error.message 
        });
    }
});

// Update event details
router.put('/:eventId', auth, async (req, res) => {
    try {
        const event = await Event.findOne({
            _id: req.params.eventId,
            manager: req.manager.id
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Update fields
        const updatableFields = [
            'title',
            'description',
            'registrationDeadline',
            'eventDate',
            'venue',
            'teamSize',
            'registrationFee',
            'prizePool',
            'rules',
            'requirements'
        ];

        updatableFields.forEach(field => {
            if (req.body[field] !== undefined) {
                event[field] = req.body[field];
            }
        });

        await event.save();
        res.json(event);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Error updating event', error: error.message });
    }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
    try {
        const event = await Event.findOne({ 
            _id: req.params.id,
            manager: req.manager.id 
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        // Check if event has already started
        if (new Date() > new Date(event.startDate)) {
            return res.status(400).json({ 
                message: 'Cannot delete event after it has started' 
            });
        }

        await Event.findByIdAndDelete(req.params.id);
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get event statistics
router.get('/:id/stats', auth, async (req, res) => {
    try {
        const event = await Event.findOne({ 
            _id: req.params.id,
            manager: req.manager.id 
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        const stats = {
            totalTeams: event.registeredTeams,
            registrationStatus: event.isRegistrationOpen ? 'Open' : 'Closed',
            eventStatus: event.currentStatus,
            spotsLeft: event.maxTeams - event.registeredTeams
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching event statistics:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Generate/Regenerate share link
router.post('/:id/share', auth, async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, manager: req.manager.id });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Generate new share link
        event.shareLink = `${event._id}-${Math.random().toString(36).substring(2, 8)}`;
        event.isPublic = true;
        await event.save();

        res.json({ 
            shareLink: event.shareLink,
            publicUrl: `${process.env.FRONTEND_URL}/events/public/${event.shareLink}`
        });
    } catch (error) {
        console.error('Error generating share link:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Disable sharing
router.delete('/:id/share', auth, async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, manager: req.user.id });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        event.isPublic = false;
        await event.save();

        res.json({ message: 'Event sharing disabled' });
    } catch (error) {
        console.error('Error disabling share link:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get public event by share link
router.get('/public/events/:shareLink', async (req, res) => {
    try {
        const event = await Event.findOne({
            shareLink: req.params.shareLink,
            isPublic: true
        }).populate('manager', 'email organization');

        if (!event) {
            return res.status(404).json({ message: 'Event not found or registration link is invalid' });
        }

        // Format the event data for public view
        const publicEventData = {
            ...event.toObject(),
            manager: {
                organization: event.manager.organization
            }
        };

        res.json(publicEventData);
    } catch (error) {
        console.error('Error fetching public event:', error);
        res.status(400).json({ 
            message: 'Error fetching event', 
            error: error.message 
        });
    }
});

// Public registration route
router.post('/public/events/:shareLink/register', async (req, res) => {
    try {
        const event = await Event.findOne({
            shareLink: req.params.shareLink,
            isPublic: true
        }).populate('manager', 'email');

        if (!event) {
            return res.status(404).json({ message: 'Event not found or registration is closed' });
        }

        // Check if registration is still open
        const now = new Date();
        if (now > new Date(event.registrationDeadline)) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }

        // Validate team size
        if (req.body.members.length < event.teamSize.min || req.body.members.length > event.teamSize.max) {
            return res.status(400).json({ 
                message: `Team size must be between ${event.teamSize.min} and ${event.teamSize.max} members` 
            });
        }

        // Create new team
        const team = new Team({
            name: req.body.name,
            event: event._id,
            members: req.body.members,
            paymentStatus: event.entryFee > 0 ? 'pending' : 'not_required',
            paymentDetails: event.entryFee > 0 ? {
                amount: event.entryFee,
                upiTransactionId: req.body.upiTransactionId
            } : undefined
        });

        await team.save();

        // Send confirmation email
        try {
            await sendRegistrationPendingEmail(
                team.members[0].email,
                {
                    teamName: team.name,
                    eventName: event.title,
                    paymentStatus: team.paymentStatus,
                    amount: event.entryFee,
                    transactionId: req.body.upiTransactionId
                }
            );
        } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
        }

        res.status(201).json({
            message: 'Team registered successfully',
            teamId: team._id,
            paymentStatus: team.paymentStatus
        });
    } catch (error) {
        console.error('Error in team registration:', error);
        res.status(400).json({ 
            message: 'Error registering team', 
            error: error.message 
        });
    }
});

// Export teams to CSV
router.get('/:eventId/export-csv', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Build query based on status filter
        const query = { event: req.params.eventId };
        if (req.query.status && req.query.status !== 'all') {
            query.paymentStatus = req.query.status;
        }

        const teams = await Team.find(query).populate('members');

        const fields = [
            'Team Name',
            'Registration Date',
            'Payment Status',
            'Transaction ID',
            'Team Leader',
            'Leader Email',
            'Leader Phone',
            'Leader Register No',
            'Members',
            'Member Details'
        ];

        const data = teams.map(team => {
            const leader = team.members.find(m => m.isLeader) || team.members[0];
            const otherMembers = team.members.filter(m => !m.isLeader);
            
            return {
                'Team Name': team.name,
                'Registration Date': new Date(team.registrationDate).toLocaleString(),
                'Payment Status': team.paymentStatus,
                'Transaction ID': team.paymentDetails?.upiTransactionId || 'N/A',
                'Team Leader': leader.name,
                'Leader Email': leader.email,
                'Leader Phone': leader.mobileNumber,
                'Leader Register No': leader.registerNumber,
                'Members': team.members.length,
                'Member Details': otherMembers.map(m => 
                    `${m.name} (${m.registerNumber})`
                ).join(', ')
            };
        });

        const csv = json2csv(data, { fields });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${event.title}-${req.query.status || 'all'}-teams.csv`);
        res.send(csv);

    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ message: 'Error exporting CSV' });
    }
});

// Export teams to PDF
router.get('/:eventId/export-pdf', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Build query based on status filter
        const query = { event: req.params.eventId };
        if (req.query.status && req.query.status !== 'all') {
            query.paymentStatus = req.query.status;
        }

        const teams = await Team.find(query).populate('members');

        const doc = new PDFDocument();
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${event.title}-${req.query.status || 'all'}-teams.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add content to PDF
        doc.fontSize(20).text(event.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text(`${req.query.status === 'all' ? 'All' : req.query.status} Teams`, { align: 'center' });
        doc.fontSize(12).text(`Total Teams: ${teams.length}`, { align: 'center' });
        doc.moveDown();

        // Add team details
        teams.forEach((team, index) => {
            const leader = team.members.find(m => m.isLeader) || team.members[0];
            const otherMembers = team.members.filter(m => !m.isLeader);

            doc.fontSize(14).text(`Team ${index + 1}: ${team.name}`);
            doc.fontSize(12).text(`Registration Date: ${new Date(team.registrationDate).toLocaleString()}`);
            doc.text(`Payment Status: ${team.paymentStatus}`);
            doc.text(`Transaction ID: ${team.paymentDetails?.upiTransactionId || 'N/A'}`);
            doc.moveDown();

            doc.text('Team Leader:');
            doc.text(`Name: ${leader.name}`);
            doc.text(`Email: ${leader.email}`);
            doc.text(`Phone: ${leader.mobileNumber}`);
            doc.text(`Register No: ${leader.registerNumber}`);
            doc.moveDown();

            if (otherMembers.length > 0) {
                doc.text('Other Members:');
                otherMembers.forEach(member => {
                    doc.text(`- ${member.name} (${member.registerNumber})`);
                });
            }

            doc.moveDown();
            if (index < teams.length - 1) {
                doc.text('-------------------------------------------');
                doc.moveDown();
            }
        });

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error exporting PDF:', error);
        res.status(500).json({ message: 'Error exporting PDF' });
    }
});

module.exports = router;
