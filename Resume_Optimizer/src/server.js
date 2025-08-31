const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

// Import modules
const config = require('./config');
const { configureMiddleware } = require('./middleware');
const analysisRoutes = require('./routes/analysis');
const coverLetterRoutes = require('./routes/coverLetter');
const submissionsRoutes = require('./routes/submissions');

const app = express();

// Configure middleware
configureMiddleware(app);

// Routes
app.use('/api', analysisRoutes);
app.use('/api', coverLetterRoutes);
app.use('/api', submissionsRoutes);

// Serve index.html on root
app.get('/', (req, res) => {
  const publicDir = path.join(__dirname, '..', 'public');
  res.sendFile(path.join(publicDir, 'index.html'));
});

// MongoDB connection and server start
mongoose
  .connect(config.MONGODB_URI, { autoIndex: true })
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(config.PORT, () => console.log(`Server listening on http://localhost:${config.PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
