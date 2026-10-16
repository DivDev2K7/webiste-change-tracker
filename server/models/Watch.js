import mongoose from 'mongoose';

const watchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true, trim: true },
    // Requirement 1: interval from 15 minutes to 24 hours
    intervalMinutes: { type: Number, required: true, min: 15, max: 1440, default: 60 },

    // Requirement 5: regions to watch / ignore (CSS selectors)
    selectors: { type: [String], default: [] },
    ignoreSelectors: { type: [String], default: [] },

    // Requirement 4: how sensitive alerts are (low | medium | high)
    sensitivity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    // Bonus: only alert when one of these keywords appears in the NEW content
    keywords: { type: [String], default: [] },

    // Requirement 7: where alerts go
    notify: {
      email: { type: String, default: '' },
      discordWebhook: { type: String, default: '' },
      telegramChatId: { type: String, default: '' },
      digest: { type: Boolean, default: false } // batch alerts into a daily digest
    },

    active: { type: Boolean, default: true },

    // Requirement 8: dashboard fields
    status: { type: String, enum: ['pending', 'ok', 'error', 'blocked'], default: 'pending' },
    lastError: { type: String, default: '' },
    lastSummary: { type: String, default: '' }, // one-line summary of the latest change (dashboard card)
    lastChecked: Date,
    lastChanged: Date,
    nextCheckAt: { type: Date, default: () => new Date(), index: true },

    // Internal state used by the scheduler
    lastHash: String,
    consecutiveFailures: { type: Number, default: 0 },
    consecutiveChanges: { type: Number, default: 0 },
    noisy: { type: Boolean, default: false }, // changes on (almost) every load
    lastAlertAt: Date,
    failureAlerted: { type: Boolean, default: false },
    rebaseline: { type: Boolean, default: false } // settings changed -> next snapshot is a fresh baseline
  },
  { timestamps: true }
);

export default mongoose.model('Watch', watchSchema);
