const mongoose = require('mongoose');

const hackathonSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
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
        type: {
            city: {
                type: String,
                required: true
            },
            address: {
                type: String,
                required: true
            }
        },
        required: true
    },
    maxTeamSize: {
        type: Number,
        required: true,
        default: 4
    },
    minTeamSize: {
        type: Number,
        required: true,
        default: 1
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'completed'],
        default: 'draft'
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Manager',
        required: true
    },
    registeredTeams: [{
        teamName: String,
        members: [{
            studentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Student'
            },
            name: String,
            email: String,
            role: String
        }],
        projectDescription: String,
        registrationDate: {
            type: Date,
            default: Date.now
        }
    }],
    prizes: [{
        rank: String,
        description: String,
        value: Number
    }],
    technologies: [String],
    shareLink: {
        type: String,
        unique: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Hackathon', hackathonSchema);
