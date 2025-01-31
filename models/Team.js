const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Team name is required'],
        trim: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    registrationDate: {
        type: Date,
        default: Date.now
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
            trim: true
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
        required: function() {
            return this.paymentStatus === 'pending';
        }
    },
    verificationDate: {
        type: Date
    }
}, {
    timestamps: true
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

module.exports = mongoose.model('Team', teamSchema);
