const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const publicEventRoutes = require('./routes/publicEvents');
const teamRoutes = require('./routes/teams');
const studentAuthRoutes = require('./routes/studentAuth');
const path = require('path');

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173', // Allow local development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Apply CORS with configuration
app.use(cors(corsOptions));
app.use(express.json());

// Enable pre-flight requests for all routes
app.options('*', cors(corsOptions));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/public/events', publicEventRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/student', studentAuthRoutes);

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'Event Management API is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
    });

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation error',
            errors: Object.values(err.errors).map(e => e.message)
        });
    }

    if (err.name === 'MongoServerError' && err.code === 11000) {
        return res.status(400).json({
            message: 'Duplicate key error',
            field: Object.keys(err.keyPattern)[0]
        });
    }

    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    // Don't exit the process in production
    if (process.env.NODE_ENV === 'development') {
        process.exit(1);
    }
});

module.exports = app;
