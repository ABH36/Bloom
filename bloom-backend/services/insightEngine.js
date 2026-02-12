const mongoose = require('mongoose');
const Couple = require('../models/Couple');
const WeeklyInsight = require('../models/WeeklyInsight');
const MoodLog = require('../models/MoodLog');
const AppreciationLog = require('../models/AppreciationLog');
const Memory = require('../models/Memory');
const Notification = require('../models/Notification');
const logger = require('../utils/logger'); // Central Logger

// Helper: Get formatted date string YYYY-MM-DD
const getDatestamp = (date) => date.toISOString().split('T')[0];

// Helper: Get Monday of the current week (for Idempotency key)
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff));
};

const runInsightEngine = async () => {
  logger.info('[InsightEngine] Starting Daily Analysis Cycle...');
  
  const today = new Date();
  const weekStartObj = getMonday(today);
  const weekStartStr = getDatestamp(weekStartObj);
  
  // Define 7-Day Lookback Window
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last7DaysStr = getDatestamp(last7Days);

  let processedCount = 0;
  let insightCount = 0;
  let notificationCount = 0;

  // 1. BATCH PROCESSING: Streaming Cursor
  const cursor = Couple.find({ status: 'Active' }).cursor();

  // Sequential processing (No Promise.all on full dataset)
  for (let couple = await cursor.next(); couple != null; couple = await cursor.next()) {
    try {
      processedCount++;

      // 2. IDEMPOTENCY CHECK
      // If we already generated an insight for this week (starting Monday), SKIP.
      // This ensures the heavy logic runs exactly once per week per couple.
      const exists = await WeeklyInsight.exists({ 
        coupleId: couple._id, 
        weekStart: weekStartStr 
      });

      if (exists) continue;

      // 3. AGGREGATION (Last 7 Days)
      // We run these in parallel for the *single* couple (low memory footprint)
      const [moods, appreciations, memories, fightCount] = await Promise.all([
        MoodLog.find({ coupleId: couple._id, date: { $gte: last7DaysStr } }).lean(),
        AppreciationLog.find({ coupleId: couple._id, date: { $gte: last7DaysStr } }).lean(),
        Memory.find({ coupleId: couple._id, date: { $gte: last7Days } }).lean(), // Memory uses Date obj
        MoodLog.countDocuments({ coupleId: couple._id, mood: 'Fight', date: { $gte: last7DaysStr } })
      ]);

      // Calculate Metrics
      const totalMoodScore = moods.reduce((acc, log) => {
        if (log.mood === 'Great') return acc + 2;
        if (log.mood === 'Good') return acc + 1;
        if (log.mood === 'Bad') return acc - 2;
        if (log.mood === 'Fight') return acc - 5;
        return acc;
      }, 0);
      
      const averageMood = moods.length > 0 ? (totalMoodScore / moods.length).toFixed(1) : 0;

      // Interaction Days (Unique dates with activity)
      const activityDates = new Set();
      moods.forEach(m => activityDates.add(m.date));
      appreciations.forEach(a => activityDates.add(a.date));
      memories.forEach(m => activityDates.add(getDatestamp(m.date)));
      const interactionDays = activityDates.size;

      // 4. RISK LOGIC (Production Rules)
      let riskLevel = 'Low';
      let actionRequired = false;

      // Rule: High Risk
      if (couple.score < 30 || fightCount >= 3 || interactionDays <= 2) {
        riskLevel = 'High';
        actionRequired = true;
      } 
      // Rule: Medium Risk
      else if ((couple.score >= 30 && couple.score <= 50) || interactionDays <= 4) {
        riskLevel = 'Medium';
      }

      // 5. CREATE INSIGHT
      await WeeklyInsight.create({
        coupleId: couple._id,
        weekStart: weekStartStr,
        weekEnd: getDatestamp(today),
        averageMood,
        interactionDays,
        appreciationCount: appreciations.length,
        memoryCount: memories.length,
        fightCount,
        scoreChange: 0, // Placeholder: Requires tracking previous week's score
        riskLevel,
        actionRequired
      });

      insightCount++;

      // 6. UPDATE COUPLE STATE
      if (actionRequired) {
        // We don't have a specific 'riskLevel' field in Couple Schema phase 2/3, 
        // but typically we'd set a flag or just rely on notifications.
        // For strict schema adherence, we only send notifications now.
      }

      // 7. NOTIFICATION INTEGRATION (High Risk Only)
      if (riskLevel === 'High') {
        const todayStr = getDatestamp(today);

        // Process for BOTH users
        for (const userId of couple.users) {
          // Check Daily Limit (Max 3)
          const dailyCount = await Notification.countDocuments({
            userId,
            date: todayStr
          });

          if (dailyCount < 3) {
            await Notification.create({
              userId,
              type: 'HighRisk',
              priority: 'high',
              message: 'Relationship Alert: Interaction levels are critically low. Tap for recovery tips.',
              date: todayStr
            });
            notificationCount++;
          }
        }
      }

    } catch (err) {
      logger.error(`[InsightEngine] Error processing couple ${couple._id}`, err);
      // Continue to next couple
    }
  }

  logger.info(`[InsightEngine] Cycle Complete. Processed: ${processedCount}, Created: ${insightCount}, Alerts: ${notificationCount}`);
};

module.exports = { runInsightEngine };