const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const managerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    organization: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['professor', 'hod', 'coordinator', 'other']
    },
    eventsCreated: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    }]
}, { timestamps: true });

// Hash password before saving
managerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Method to check password
managerSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Manager', managerSchema);
