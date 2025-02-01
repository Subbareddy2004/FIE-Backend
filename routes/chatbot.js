const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Event = require('../models/Event');

// Initialize Gemini API with configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to get all hackathons
async function getAllHackathons() {
  try {
    const hackathons = await Event.find({})
      .select('title description startDate endDate venue prizes requirements');
    console.log('Found hackathons:', hackathons.length);
    return hackathons;
  } catch (error) {
    console.error('Error fetching hackathons:', error);
    return [];
  }
}

// Helper function to get nearest hackathons
async function getNearestHackathons() {
  const currentDate = new Date();
  try {
    const hackathons = await Event.find({
      startDate: { $gte: currentDate },
      status: 'upcoming'
    })
    .sort({ startDate: 1 })
    .limit(5);
    
    console.log('Found nearest hackathons:', hackathons.length);
    return hackathons;
  } catch (error) {
    console.error('Error fetching nearest hackathons:', error);
    return [];
  }
}

// Helper function to generate response
async function generateResponse(hackathons, question) {
  if (!hackathons || hackathons.length === 0) {
    return "I don't have any hackathons in the database at the moment.";
  }

  const hackathonInfo = hackathons.map(h => ({
    name: h.title,
    date: `${new Date(h.startDate).toLocaleDateString()} - ${new Date(h.endDate).toLocaleDateString()}`,
    location: h.venue ? `${h.venue.city}, ${h.venue.country}` : 'Location not specified',
    entryFee: h.entryFee || 0,
    prizes: h.prizes || 'Not specified',
    requirements: h.requirements || 'Not specified',
    status: h.status,
    maxTeams: h.maxTeams,
    registrationDeadline: new Date(h.registrationDeadline).toLocaleDateString()
  }));

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
      You are a helpful hackathon assistant. Here are the current hackathons:
      ${JSON.stringify(hackathonInfo, null, 2)}

      Question: ${question}
      
      Rules for your response:
      1. Provide a BRIEF response (max 3 sentences) that directly answers the question.
      2. Only use information from the hackathon data provided above.
      3. If asked about fees, always mention the exact amount in ₹.
      4. If asked about dates, format them clearly.
      5. If the specific information isn't available, say so politely.
      6. Use emoji icons to make the response more engaging.
      7. For questions about "nearest" or "upcoming" events, prioritize those with the earliest start dates.
      8. If asked about registration, include the deadline and available slots.

      Format your response to be concise and easy to read.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('AI Error:', error);
    // Fallback response with basic information
    return hackathonInfo.map(h => 
      `🚀 ${h.name} (Entry Fee: ₹${h.entryFee})\n` +
      `📍 ${h.location}\n` +
      `📅 ${h.date}`
    ).join('\n\n');
  }
}

router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    console.log('Received question:', question);
    let hackathons;

    // Determine which hackathons to fetch based on the question
    if (question.toLowerCase().includes('nearest') || 
        question.toLowerCase().includes('upcoming')) {
      hackathons = await getNearestHackathons();
    } else if (question.toLowerCase().includes('fee') || 
               question.toLowerCase().includes('cost') ||
               question.toLowerCase().includes('price')) {
      // Get all hackathons but sort by entry fee
      hackathons = await Event.find({})
        .sort({ entryFee: 1 })
        .select('title description startDate endDate venue prizes requirements entryFee status maxTeams registrationDeadline');
    } else {
      hackathons = await getAllHackathons();
    }

    const response = await generateResponse(hackathons, question);
    res.json({ response });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ 
      message: 'Failed to get response',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
