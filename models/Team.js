const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    registerNumber: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true
    },
    isLeader: {
        type: Boolean,
        default: false
    }
});

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    members: [teamMemberSchema],
    registrationStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
