const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');
const { checkBudgetAlerts } = require('./utils/alertService');
const { processIncomingMessage } = require('./services/smsAutomator');
const { protect } = require('./middleware/auth');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Socket.io Connection logic
io.on('connection', (socket) => {
  console.log('Client connected to WebSocket');
  
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their private channel`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/ai-assistant', require('./routes/ai-assistant'));
app.use('/api/alerts', require('./routes/alerts'));

// Autonomous Message Sync Endpoint
app.post('/api/messages/webhook', protect, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'No message provided' });
  
  const result = await processIncomingMessage(req.user.id, message, io);
  res.json(result);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Finance Manager API is running' });
});

// Connect to database and then start server
const startServer = async () => {
  try {
    await connectDB();
    
    // Run budget alert checks every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Running scheduled budget alert check...');
      await checkBudgetAlerts();
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error(`Error starting server: ${err.message}`);
    process.exit(1);
  }
};

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

startServer();
