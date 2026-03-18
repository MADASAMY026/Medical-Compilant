import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: String,
  ward: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  department: String,
  address: {
    type: String,
    required: true
  },
  landmark: String,
  pinCode: String,
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Resolved', 'Critical'],
    default: 'Pending'
  },
  photos: [String],
  location: {
    latitude: Number,
    longitude: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Complaint = mongoose.model('Complaint', complaintSchema);

export default Complaint;
