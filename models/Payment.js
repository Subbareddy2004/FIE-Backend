const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    razorpayPaymentId: {
        type: String,
        unique: true,
        sparse: true
    },
    razorpayOrderId: {
        type: String,
        unique: true,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['created', 'authorized', 'captured', 'refunded', 'failed'],
        default: 'created'
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'netbanking', 'wallet', 'upi', 'other'],
        required: true
    },
    refundStatus: {
        type: String,
        enum: ['none', 'pending', 'processed', 'failed'],
        default: 'none'
    },
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ event: 1, status: 1 });
paymentSchema.index({ team: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
