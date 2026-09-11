const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  authorName: { type: String, required: true, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  date: { type: Date, default: Date.now }
}, { _id: true });

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  summary: { type: String, required: true, trim: true, maxlength: 500 },
  content: { type: String, required: true, maxlength: 10000 },
  tags: [{ type: String, trim: true }],
  image: { type: String, default: null },
  authorName: { type: String, required: true, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  date: { type: Date, default: Date.now },
  views: { type: Number, default: 0, min: 0 },
  comments: [commentSchema]
}, { timestamps: true });

blogSchema.index({ title: 'text', summary: 'text', content: 'text', tags: 'text' });
blogSchema.index({ date: -1 });
blogSchema.index({ authorId: 1 });

module.exports = mongoose.model('Blog', blogSchema);
