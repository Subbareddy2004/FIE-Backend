const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Manager',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    registrationDeadline: {
        type: Date,
        required: true
    },
    venue: {
        name: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        }
    },
    rules: {
        type: [String],
        default: []
    },
    entryFee: {
        type: Number,
        default: 0
    },
    maxTeams: {
        type: Number,
        required: true
    },
    teamSize: {
        min: {
            type: Number,
            required: true,
            default: 1
        },
        max: {
            type: Number,
            required: true,
            default: 4
        }
    },
    departments: {
        type: [String],
        required: true,
        default: ['All']
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed'],
        default: 'upcoming'
    },
    registeredTeams: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Virtual field for registration status
eventSchema.virtual('isRegistrationOpen').get(function() {
    return new Date() <= this.registrationDeadline;
});

// Virtual field for event status
eventSchema.virtual('currentStatus').get(function() {
    const now = new Date();
    if (now < this.startDate) return 'upcoming';
    if (now > this.endDate) return 'completed';
    return 'ongoing';
});

module.exports = mongoose.model('Event', eventSchema);
