import mongoose from 'mongoose';

// A snapshot is stored ONLY when the content hash changes (Requirement 3).
const snapshotSchema = new mongoose.Schema(
  {
    watch: { type: mongoose.Schema.Types.ObjectId, ref: 'Watch', required: true, index: true },
    hash: { type: String, required: true },
    text: { type: String, default: '' }, // noise-filtered page text
    screenshot: { type: String, default: '' }, // path relative to SCREENSHOT_DIR
    summary: { type: String, default: null }, // best-effort AI change summary
    stats: {
      added: { type: Number, default: 0 },
      removed: { type: Number, default: 0 },
      ratio: { type: Number, default: 0 }
    },
    alert: {
      status: {
        type: String,
        enum: ['none', 'sent', 'digest', 'suppressed', 'failed'],
        default: 'none'
      },
      reason: { type: String, default: '' },
      channels: { type: [String], default: [] },
      at: Date
    },
    digestPending: { type: Boolean, default: false, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

snapshotSchema.index({ watch: 1, createdAt: -1 });

export default mongoose.model('Snapshot', snapshotSchema);
