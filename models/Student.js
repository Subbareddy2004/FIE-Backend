const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
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
    college: {
        type: String,
        required: true
    },
    registeredHackathons: [{
        hackathonId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hackathon'
        },
        teamName: String,
        teamMembers: [String],
        projectDescription: String,
        submissionDate: Date
    }]
}, { timestamps: true });

// Hash password before saving
studentSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to check password
studentSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Student', studentSchema);
