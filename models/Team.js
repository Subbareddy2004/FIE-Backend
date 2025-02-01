const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: [true, 'Team name is required'],
        trim: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    members: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
        },
        registerNumber: {
            type: String,
            required: true,
            trim: true
        },
        mobileNumber: {
            type: String,
            required: true,
            trim: true,
            match: [/^\d{10}$/, 'Please enter a valid 10-digit mobile number']
        },
        isLeader: {
            type: Boolean,
            default: false
        }
    }],
    paymentStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected', 'not_required'],
        default: 'not_required'
    },
    upiTransactionId: {
        type: String,
        trim: true,
        sparse: true
    },
    registrationDate: {
        type: Date,
        default: Date.now
    },
    verificationDate: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add index for faster queries
teamSchema.index({ event: 1, 'members.email': 1 });
teamSchema.index({ event: 1, paymentStatus: 1 });

// Ensure team size is within event limits
teamSchema.pre('save', async function(next) {
    if (this.isModified('members')) {
        const Event = mongoose.model('Event');
        const event = await Event.findById(this.event);
        
        if (!event) {
            next(new Error('Event not found'));
            return;
        }

        if (this.members.length < event.minTeamSize) {
            next(new Error(`Team must have at least ${event.minTeamSize} members`));
            return;
        }

        if (this.members.length > event.maxTeamSize) {
            next(new Error(`Team cannot have more than ${event.maxTeamSize} members`));
            return;
        }
    }
    next();
});

// Virtual for leader
teamSchema.virtual('leader').get(function() {
    if (!this.members || !Array.isArray(this.members)) return null;
    return this.members.find(member => member && member.isLeader);
});

// Virtual for member count
teamSchema.virtual('memberCount').get(function() {
    if (!this.members || !Array.isArray(this.members)) return 0;
    return this.members.length;
});

module.exports = mongoose.model('Team', teamSchema);
