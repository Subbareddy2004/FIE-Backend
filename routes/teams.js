const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Team = require('../models/Team');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const { sendRegistrationPendingEmail, sendPaymentVerificationEmail } = require('../services/emailService');

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

// Register team for an event
router.post('/register/:eventId', async (req, res) => {
    try {
        console.log('Registration request received:', {
            eventId: req.params.eventId,
            body: req.body
        });

        const event = await Event.findById(req.params.eventId).populate('manager', 'email phone organization');
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
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

        // Check if any team member is already registered
        const existingTeams = await Team.find({
            event: event._id,
            'members.email': { $in: req.body.members.map(m => m.email) }
        });

        if (existingTeams.length > 0) {
            return res.status(400).json({ 
                message: 'One or more team members are already registered for this event' 
            });
        }

        // Create new team with registration date
        const team = new Team({
            ...req.body,
            event: event._id,
            registeredAt: new Date(),
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
                    transactionId: req.body.upiTransactionId,
                    members: team.members.map(member => ({
                        name: member.name,
                        email: member.email,
                        registerNumber: member.registerNumber,
                        mobileNumber: member.mobileNumber,
                        isLeader: member.isLeader
                    })),
                    eventManager: {
                        email: event.manager.email,
                        phone: event.manager.phone,
                        organization: event.manager.organization
                    }
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
        console.error('Error registering team:', error);
        res.status(400).json({ 
            message: 'Error registering team', 
            error: error.message 
        });
    }
});

// Verify team payment (manager only)
router.post('/:teamId/verify-payment', auth, async (req, res) => {
    try {
        const { status, remarks } = req.body;
        
        const team = await Team.findById(req.params.teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const event = await Event.findById(team.event)
            .populate('manager', 'email');
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if the manager owns this event
        if (event.manager.toString() !== req.manager.id) {
            return res.status(403).json({ message: 'Not authorized to verify this team' });
        }

        // Update payment status
        team.payment.status = status;
        if (remarks) {
            team.payment.managerRemarks = remarks;
        }
        await team.save();

        // Send verification email
        await sendPaymentVerificationEmail(team, event, status, remarks);

        res.json({ 
            message: `Payment ${status}`,
            team 
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(400).json({ 
            message: 'Error verifying payment', 
            error: error.message 
        });
    }
});

// Get teams for an event (manager only)
router.get('/event/:eventId', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if the manager owns this event
        if (event.manager.toString() !== req.manager.id) {
            return res.status(403).json({ message: 'Not authorized to view these teams' });
        }

        const teams = await Team.find({ event: req.params.eventId })
            .populate('members');
            
        res.json(teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(400).json({ 
            message: 'Error fetching teams', 
            error: error.message 
        });
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

// Get team details by ID
router.get('/:teamId', auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId)
            .populate({
                path: 'event',
                populate: {
                    path: 'manager',
                    select: 'email phone organization'
                }
            });

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        res.json(team);
    } catch (error) {
        console.error('Error fetching team details:', error);
        res.status(500).json({ message: 'Error fetching team details' });
    }
});

// Update team payment status
router.put('/:teamId/payment-status', auth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        
        // Validate status
        const validStatuses = ['verified', 'rejected', 'pending', 'not_required'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const team = await Team.findById(req.params.teamId)
            .populate({
                path: 'event',
                populate: {
                    path: 'manager',
                    select: 'email phone organization'
                }
            });

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Update payment status and details
        team.paymentStatus = status;
        team.paymentDetails = {
            ...team.paymentDetails,
            notes: notes || undefined,
            verificationDate: new Date(),
            verifiedBy: req.manager._id
        };

        await team.save();

        // Fetch the updated team
        const updatedTeam = await Team.findById(req.params.teamId)
            .populate({
                path: 'event',
                populate: {
                    path: 'manager',
                    select: 'email phone organization'
                }
            });

        // Send email notification
        try {
            await sendPaymentVerificationEmail(
                team.members.find(m => m.isLeader)?.email || team.members[0].email,
                {
                    teamName: team.name,
                    eventName: team.event.title,
                    status,
                    amount: team.event.entryFee,
                    transactionId: team.paymentDetails?.upiTransactionId,
                    notes,
                    members: team.members.map(member => ({
                        name: member.name,
                        email: member.email,
                        registerNumber: member.registerNumber,
                        mobileNumber: member.mobileNumber,
                        isLeader: member.isLeader
                    })),
                    eventManager: {
                        email: team.event.manager?.email || 'Not specified',
                        phone: team.event.manager?.phone || 'Not specified',
                        organization: team.event.manager?.organization || 'Not specified'
                    }
                }
            );
        } catch (emailError) {
            console.error('Error sending payment verification email:', emailError);
        }

        res.json({
            message: `Payment ${status === 'verified' ? 'accepted' : 'rejected'} successfully`,
            team: updatedTeam
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Error updating payment status' });
    }
});

module.exports = router;
