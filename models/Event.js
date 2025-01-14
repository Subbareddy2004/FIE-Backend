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
    paymentDetails: {
        upiId: {
            type: String,
            required: function() {
                return this.entryFee > 0;
            }
        },
        paymentRequired: {
            type: Boolean,
            default: function() {
                return this.entryFee > 0;
            }
        }
    },
    maxTeams: {
        type: Number,
        required: true,
        min: 1
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
    },
    totalPaymentsReceived: {
        type: Number,
        default: 0
    },
    shareLink: {
        type: String,
        unique: true,
        sparse: true
    },
    isPublic: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Generate share link before saving if not exists
eventSchema.pre('save', function(next) {
    if (!this.shareLink) {
        this.shareLink = `${this._id}-${Math.random().toString(36).substring(2, 8)}`;
    }
    next();
});

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
