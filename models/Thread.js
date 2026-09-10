const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  author: { type: String, required: true, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  image: { type: String, default: null },
  deleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const threadSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  content: { type: String, required: true, trim: true, maxlength: 5000 },
  game: { type: String, default: '' },
  tag: {
    type: String,
    enum: ['general', 'support', 'review', 'modding'],
    default: 'general'
  },
  image: { type: String, default: null },
  author: { type: String, required: true, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  views: { type: Number, default: 0, min: 0 },
  replies: { type: [replySchema], default: [] },
  deleted: { type: Boolean, default: false },
  lastPostAuthor: { type: String, default: '' },
  lastPostAt: { type: Date, default: Date.now }
}, { timestamps: true });

threadSchema.index({ title: 'text', content: 'text' });
threadSchema.index({ tag: 1 });
threadSchema.index({ lastPostAt: -1 });
threadSchema.index({ createdAt: -1 });
threadSchema.index({ authorId: 1 });

module.exports = mongoose.model('Thread', threadSchema);
