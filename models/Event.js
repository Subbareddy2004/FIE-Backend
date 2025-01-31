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
    registeredTeams: {
        type: Number,
        default: 0
    },
    departments: {
        type: [String],
        required: true
    },
    skills: {
        type: [String],
        default: []
    },
    prizes: {
        first: {
            type: Number,
            required: true
        },
        second: {
            type: Number,
            required: true
        },
        third: {
            type: Number,
            required: true
        },
        consolation: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'registration_closed', 'ongoing', 'completed'],
        default: 'draft'
    },
    isPublic: {
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
    image: {
        type: String,
        default: "https://images.unsplash.com/photo-1531482615713-2afd69097998?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80"
    },
    whatsappLink: {
        type: String,
        validate: {
            validator: function(v) {
                // Allow empty/null values or valid WhatsApp group invite links
                return !v || /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[a-zA-Z0-9_-]+$/.test(v);
            },
            message: props => `${props.value} is not a valid WhatsApp group invite link! It should start with 'https://chat.whatsapp.com/' or 'https://wa.me/'`
        },
        trim: true
    },
    teams: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    }]
}, {
    timestamps: true
});

// Virtual for total participants
eventSchema.virtual('totalParticipants').get(function() {
    return this.registeredTeams * this.maxTeamSize;
});

// Virtual field for team count
eventSchema.virtual('teamsCount').get(function() {
    return this.teams ? this.teams.length : 0;
});

// Pre-save middleware to update status based on dates
eventSchema.pre('save', function(next) {
    const now = new Date();
    
    if (now < this.startDate) {
        this.status = 'published';
    } else if (now >= this.startDate && now <= this.endDate) {
        this.status = 'ongoing';
    } else if (now > this.endDate) {
        this.status = 'completed';
    }
    
    if (now > this.registrationDeadline || this.registeredTeams >= this.maxTeams) {
        this.status = 'registration_closed';
    }
    
    next();
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
