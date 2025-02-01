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
        },
        state: {
            type: String,
            required: true
        },
        country: {
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
            },
            trim: true
        },
        accountName: {
            type: String,
            trim: true
        },
        notes: {
            type: String,
            trim: true
        }
    },
    maxTeams: {
        type: Number,
        required: true,
        min: 1
    },
    minTeamSize: {
        type: Number,
        required: true,
        min: 1
    },
    maxTeamSize: {
        type: Number,
        required: true,
        min: 1
    },
    teams: [{
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Team',
            required: true
        },
        teamName: {
            type: String,
            required: true
        },
        members: [{
            name: String,
            email: String,
            role: {
                type: String,
                enum: ['leader', 'member']
            }
        }],
        registrationDate: {
            type: Date,
            default: Date.now
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'verified', 'rejected', 'not_required'],
            default: 'not_required'
        }
    }],
    departments: {
        type: [String],
        required: true
    },
    skills: {
        type: [String],
        default: []
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    isRegistrationOpen: {
        type: Boolean,
        default: true
    },
    shareLink: {
        type: String,
        unique: true,
        sparse: true
    },
    whatsappLink: {
        type: String,
        validate: {
            validator: function(v) {
                if (!v) return true;
                return v.startsWith('https://chat.whatsapp.com/') || v.startsWith('https://wa.me/');
            },
            message: props => `${props.value} is not a valid WhatsApp group invite link! It should start with 'https://chat.whatsapp.com/' or 'https://wa.me/'`
        },
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Event', eventSchema);
