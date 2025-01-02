const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const auth = require('../middleware/auth');

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
        res.status(400).json({ 
            message: 'Invalid event data', 
            error: error.message 
        });
    }
});

// Get event by ID
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('manager', 'name organization');
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
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
        res.status(400).json({ 
            message: 'Invalid update data', 
            error: error.message 
        });
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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
