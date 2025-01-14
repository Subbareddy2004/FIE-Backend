const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    registeredAt: {
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
            lowercase: true
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
    paymentDetails: {
        amount: {
            type: Number,
            required: function() {
                return this.paymentStatus !== 'not_required';
            }
        },
        upiTransactionId: {
            type: String,
            required: function() {
                return this.paymentStatus === 'pending';
            },
            trim: true
        },
        verificationDate: {
            type: Date
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Manager'
        },
        notes: {
            type: String,
            trim: true
        }
    },
    registrationDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Add index for faster queries
teamSchema.index({ event: 1, 'members.email': 1 });
teamSchema.index({ event: 1, paymentStatus: 1 });

module.exports = mongoose.model('Team', teamSchema);
