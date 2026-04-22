const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const AiAssistantService = require('../services/aiAssistantService');

// @route   GET /api/ai-assistant/analysis
// @desc    Get full AI financial analysis
// @access  Private
router.get('/analysis', protect, async (req, res) => {
  try {
    const analysis = await AiAssistantService.getFullAnalysis(req.user.id);
    res.json({ success: true, data: analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Analysis failed' });
  }
});

// @route   POST /api/ai-assistant/chat
// @desc    Ask AI assistant a question
// @access  Private
router.post('/chat', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const response = await AiAssistantService.handleChatQuery(req.user.id, message);
    res.json({ success: true, response });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Chat failed' });
  }
});

module.exports = router;
