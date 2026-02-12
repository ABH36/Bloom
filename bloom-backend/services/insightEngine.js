const mongoose = require('mongoose');
const Couple = require('../models/Couple');
const WeeklyInsight = require('../models/WeeklyInsight');
const MoodLog = require('../models/MoodLog');
const AppreciationLog = require('../models/AppreciationLog');
const Memory = require('../models/Memory');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// Helper: Get formatted date string YYYY-MM-DD
const getDatestamp = (date) => date.toISOString().split('T')[0];

// Helper: Get Monday of the current week (for Idempotency key)
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const runInsightEngine = async () => {
  const today = new Date();
  
  // 1. WEEKLY EXECUTION GUARD
  // Only run on Monday (UTC Day 1)
  if (today.getUTCDay() !== 1) {
    logger.info('[InsightEngine] Skipped - Not weekly run day (Monday)');
    return;
  }

  logger.info('[InsightEngine] Starting Weekly Analysis Cycle...');
  
  const weekStartObj = getMonday(today);
  const weekStartStr = getDatestamp(weekStartObj);
  
  // Define 7-Day Lookback Window
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last7DaysStr = getDatestamp(last7Days);

  let processedCount = 0;
  let insightCount = 0;
  let notificationCount = 0;

  // 2. BATCH PROCESSING: Streaming Cursor
  // Efficiently streams couples without loading all into memory
  const cursor = Couple.find({ status: 'Active' }).cursor();

  for (let couple = await cursor.next(); couple != null; couple = await cursor.next()) {
    try {
      processedCount++;

      // 3. IDEMPOTENCY CHECK
      // If insight already exists for this week, skip.
      const exists = await WeeklyInsight.exists({ 
        coupleId: couple._id, 
        weekStart: weekStartStr 
      });

      if (exists) continue;

      // 4. SEQUENTIAL AGGREGATION (No Promise.all)
      // Prevents DB connection spikes during batch processing.
      // All queries rely on Index: { coupleId: 1, date: 1 } (or -1 for Memory)
      
      const moods = await MoodLog.find({ 
        coupleId: couple._id, 
        date: { $gte: last7DaysStr } 
      }).lean();

      const appreciations = await AppreciationLog.find({ 
        coupleId: couple._id, 
        date: { $gte: last7DaysStr } 
      }).lean();

      // Memory uses Date object for comparison
      const memories = await Memory.find({ 
        coupleId: couple._id, 
        date: { $gte: last7Days } 
      }).lean();

      const fightCount = await MoodLog.countDocuments({ 
        coupleId: couple._id, 
        mood: 'Fight', 
        date: { $gte: last7DaysStr } 
      });

      // Calculate Metrics
      const totalMoodScore = moods.reduce((acc, log) => {
        if (log.mood === 'Great') return acc + 2;
        if (log.mood === 'Good') return acc + 1;
        if (log.mood === 'Bad') return acc - 2;
        if (log.mood === 'Fight') return acc - 5;
        return acc;
      }, 0);
      
      const averageMood = moods.length > 0 ? (totalMoodScore / moods.length).toFixed(1) : 0;

      // Interaction Days Calculation
      const activityDates = new Set();
      moods.forEach(m => activityDates.add(m.date));
      appreciations.forEach(a => activityDates.add(a.date));
      memories.forEach(m => activityDates.add(getDatestamp(m.date)));
      const interactionDays = activityDates.size;

      // 5. RISK LOGIC
      let riskLevel = 'Low';
      let actionRequired = false;

      if (couple.score < 30 || fightCount >= 3 || interactionDays <= 2) {
        riskLevel = 'High';
        actionRequired = true;
      } 
      else if ((couple.score >= 30 && couple.score <= 50) || interactionDays <= 4) {
        riskLevel = 'Medium';
      }

      // 6. CREATE INSIGHT
      await WeeklyInsight.create({
        coupleId: couple._id,
        weekStart: weekStartStr,
        weekEnd: getDatestamp(today),
        averageMood,
        interactionDays,
        appreciationCount: appreciations.length,
        memoryCount: memories.length,
        fightCount,
        scoreChange: 0, 
        riskLevel,
        actionRequired
      });

      insightCount++;

      // 7. NOTIFICATION INTEGRATION (High Risk Only)
      if (riskLevel === 'High') {
        const todayStr = getDatestamp(today);

        // Notify BOTH users
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
    }
  }

  logger.info(`[InsightEngine] Weekly Cycle Complete. Processed: ${processedCount}, Created: ${insightCount}, Alerts: ${notificationCount}`);
};

module.exports = { runInsightEngine };