import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from './db.js';
import Complaint from './models/Complaint.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Google AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
// Health Check
app.get('/api/health', (req, res) => {
  console.log('--- Health Check Requested ---');
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// AI Analyze (Mock/Proxy)
app.post('/api/analyze', async (req, res) => {
  try {
    const { description } = req.body;
    console.log(`--- AI Analysis Requested for: "${description.substring(0, 50)}..." ---`);
    if (!description) return res.status(400).json({ message: 'Description is required' });

    // Try Real Google AI if key is present
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a municipal complaint classifier for Indian cities. Return ONLY valid JSON (no markdown, no backticks, no preamble):
        {
          "category": one of [Road/Pothole, Water Supply, Drainage/Sewage, Garbage/Waste, Electrical/Streetlight, Encroachment, Noise Pollution, Other],
          "priority": one of [Low, Medium, High, Critical],
          "department": one of [Public Works, Water Board, Sanitation, Electrical, BBMP, Other],
          "summary": "max 12-word plain summary",
          "duplicate_risk": one of [Low, Medium, High],
          "sla_days": integer (e.g. 3 or 5),
          "action": "max 12-word suggested field action for officer"
        }
        Complaint: "${description.substring(0, 500)}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json|```/g, '').trim();
        return res.json(JSON.parse(text));
      } catch (aiError) {
        console.error('Real AI Error, falling back to mock:', aiError.message);
      }
    }

    // Fallback to Smart Mock
    const desc = description.toLowerCase();
    let result = {
      category: 'Other',
      priority: 'Medium',
      department: 'Other',
      summary: 'Complaint received and being analyzed.',
      duplicate_risk: 'Low',
      sla_days: 5,
      action: 'Field inspection to be scheduled.'
    };

    if (desc.includes('pothole') || desc.includes('road') || desc.includes('street')) {
      result.category = 'Road/Pothole';
      result.department = 'Public Works';
      result.summary = 'Pothole or road damage reported.';
    } else if (desc.includes('water') || desc.includes('pipe') || desc.includes('leak')) {
      result.category = 'Water Supply';
      result.department = 'Water Board';
      result.summary = 'Water supply or leakage issue.';
    } else if (desc.includes('garbage') || desc.includes('waste') || desc.includes('clean')) {
      result.category = 'Garbage/Waste';
      result.department = 'Sanitation';
      result.summary = 'Garbage collection or sanitation issue.';
    }

    if (desc.includes('urgent') || desc.includes('danger') || desc.includes('accident')) {
      result.priority = 'High';
      result.sla_days = 2;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET all complaints
app.get('/api/complaints', async (req, res) => {
  try {
    console.log('--- Fetching All Complaints ---');
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST a new complaint
app.post('/api/complaints', async (req, res) => {
  try {
    console.log('--- Creating New Complaint ---');
    console.log('Request Body:', req.body);
    // Generate a unique complaint ID if not provided (like MUN-XXXX)
    let complaintId = req.body.complaintId;
    if (!complaintId) {
      // Find the last complaint to get the highest ID
      const lastComplaint = await Complaint.findOne().sort({ createdAt: -1 });
      let nextNum = 1001;
      if (lastComplaint && lastComplaint.complaintId.startsWith('MUN-')) {
        const lastNum = parseInt(lastComplaint.complaintId.split('-')[1]);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      complaintId = `MUN-${nextNum}`;
    }

    // Ensure ID is unique
    const existing = await Complaint.findOne({ complaintId });
    if (existing) {
      // If collision, just append a random string or increment again
      complaintId = `MUN-${Date.now().toString().slice(-4)}`;
    }

    const newComplaint = new Complaint({
      ...req.body,
      complaintId
    });

    const savedComplaint = await newComplaint.save();
    res.status(201).json(savedComplaint);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET a specific complaint by ID
app.get('/api/complaints/:id', async (req, res) => {
  try {
    console.log(`--- Tracking Complaint: ${req.params.id} ---`);
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UPDATE a complaint status
app.put('/api/complaints/:id', async (req, res) => {
  try {
    console.log(`--- Updating Complaint: ${req.params.id} ---`);
    const complaint = await Complaint.findOneAndUpdate(
      { complaintId: req.params.id },
      req.body,
      { new: true }
    );
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE a complaint
app.delete('/api/complaints/:id', async (req, res) => {
  try {
    console.log(`--- Deleting Complaint: ${req.params.id} ---`);
    const complaint = await Complaint.findOneAndDelete({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json({ message: 'Complaint deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start Server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
