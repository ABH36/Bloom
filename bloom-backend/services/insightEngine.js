const mongoose = require('mongoose');
const Couple = require('../models/Couple');
const WeeklyInsight = require('../models/WeeklyInsight');
const MoodLog = require('../models/MoodLog');
const AppreciationLog = require('../models/AppreciationLog');
const Memory = require('../models/Memory');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// PROCESS-LEVEL LOCK (Prevent Overlap)
let isInsightRunning = false;

// Helper: Get formatted date string YYYY-MM-DD
const getDatestamp = (date) => date.toISOString().split('T')[0];

// Helper: Get Monday of the current week
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // Local day, but we use UTC date object below
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const runInsightEngine = async () => {
  // 1. CONCURRENCY GUARD
  if (isInsightRunning) {
    logger.warn('[InsightEngine] Previous cycle still running. Skipping...');
    return;
  }
  
  isInsightRunning = true;

  try {
    // 2. UTC DATE ENFORCEMENT
    // Ensures consistent day detection across server environments
    const today = new Date(new Date().toISOString());
    const todayStr = getDatestamp(today);
    
    // 3. DETERMINE RUN TYPE
    // Recovery Logic runs DAILY. Weekly Insights run MONDAY only.
    const isMonday = today.getUTCDay() === 1;

    logger.info(`[InsightEngine] Starting Cycle. Monday: ${isMonday}`);
    
    // Date Setup for Lookbacks
    const weekStartObj = getMonday(today);
    const weekStartStr = getDatestamp(weekStartObj);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last7DaysStr = getDatestamp(last7Days);

    let processedCount = 0;
    let insightCount = 0;
    let notificationCount = 0;
    let recoveryEntryCount = 0;
    let recoveryExitCount = 0;

    // 4. BATCH PROCESSING via Cursor
    // We iterate Active couples. Cursor ensures low memory usage.
    const cursor = Couple.find({ status: 'Active' }).cursor();

    for (let couple = await cursor.next(); couple != null; couple = await cursor.next()) {
      try {
        processedCount++;

        // --- A. DATA AGGREGATION (Common for Recovery & Insights) ---
        // We need these metrics daily to check for critical fights/risk.
        
        // Sequential Aggregation (Safe)
        const moods = await MoodLog.find({ 
          coupleId: couple._id, 
          date: { $gte: last7DaysStr } 
        }).lean();

        const appreciations = await AppreciationLog.find({ 
          coupleId: couple._id, 
          date: { $gte: last7DaysStr } 
        }).lean();

        const memories = await Memory.find({ 
          coupleId: couple._id, 
          date: { $gte: last7Days } 
        }).lean();

        const fightCount = await MoodLog.countDocuments({ 
          coupleId: couple._id, 
          mood: 'Fight', 
          date: { $gte: last7DaysStr } 
        });

        // --- B. RECOVERY MODE LOGIC (Daily Check) ---
        
        // 1. Check Exit Conditions (If currently in recovery)
        if (couple.recoveryMode) {
          const daysActive = (today - new Date(couple.recoveryStartedAt)) / (1000 * 60 * 60 * 24);
          
          // Exit Rule: Score > 50 OR > 5 days passed since recovery started
          if (couple.score > 50 || daysActive > 5) {
             couple.recoveryMode = false;
             couple.recoveryStartedAt = undefined;
             couple.recoveryLevel = undefined;
             await couple.save();
             recoveryExitCount++;
             logger.info(`[Recovery] Couple ${couple._id} exited recovery.`);
          }
        }

        // 2. Check Entry Conditions (If NOT in recovery)
        if (!couple.recoveryMode) {
           let shouldEnterRecovery = false;
           let level = 'Soft';

           // Triggers for Recovery
           if (couple.score < 30) shouldEnterRecovery = true;
           if (fightCount >= 3) shouldEnterRecovery = true;
           
           if (shouldEnterRecovery) {
             couple.recoveryMode = true;
             couple.recoveryStartedAt = today;

             // Determine Level
             if (couple.score < 20 || fightCount >= 5) level = 'Critical';
             else if (couple.score < 30) level = 'Moderate';
             else level = 'Soft';

             couple.recoveryLevel = level;
             await couple.save();
             recoveryEntryCount++;

             // Notify Users (Max 1/day check handled by Notification Logic)
             for (const userId of couple.users) {
                // Check Daily Limit for Notifications
                const dailyCount = await Notification.countDocuments({
                  userId,
                  date: todayStr
                });

                if (dailyCount < 3) {
                  await Notification.create({
                    userId,
                    type: 'HighRisk', 
                    priority: 'high',
                    message: 'We noticed things are tough. Recovery Mode activated to help you reconnect ❤️',
                    date: todayStr
                  });
                  notificationCount++;
                }
             }
             logger.info(`[Recovery] Couple ${couple._id} entered ${level} recovery.`);
           }
        }

        // --- C. WEEKLY INSIGHT (Monday Only) ---
        if (isMonday) {
          // Idempotency Check: Don't create duplicate reports for the same week
          const exists = await WeeklyInsight.exists({ 
            coupleId: couple._id, 
            weekStart: weekStartStr 
          });

          if (!exists) {
            // Metrics Calculation for Report
            const totalMoodScore = moods.reduce((acc, log) => {
              if (log.mood === 'Great') return acc + 2;
              if (log.mood === 'Good') return acc + 1;
              if (log.mood === 'Bad') return acc - 2;
              if (log.mood === 'Fight') return acc - 5;
              return acc;
            }, 0);
            
            const averageMood = moods.length > 0 ? (totalMoodScore / moods.length).toFixed(1) : 0;

            const activityDates = new Set();
            moods.forEach(m => activityDates.add(m.date));
            appreciations.forEach(a => activityDates.add(a.date));
            memories.forEach(m => activityDates.add(getDatestamp(m.date)));
            const interactionDays = activityDates.size;

            // Risk Logic for Report
            let riskLevel = 'Low';
            let actionRequired = false;

            if (couple.score < 30 || fightCount >= 3 || interactionDays <= 2) {
              riskLevel = 'High';
              actionRequired = true;
            } 
            else if ((couple.score >= 30 && couple.score <= 50) || interactionDays <= 4) {
              riskLevel = 'Medium';
            }

            // Create Insight Document
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
          }
        }

      } catch (err) {
        logger.error(`[InsightEngine] Error processing couple ${couple._id}`, err);
      }
    }

    logger.info(`[InsightEngine] Cycle Complete. Insights: ${insightCount}, Recovery Enter: ${recoveryEntryCount}, Exit: ${recoveryExitCount}, Alerts: ${notificationCount}`);

  } catch (error) {
    logger.error('[InsightEngine] Critical Failure', error);
  } finally {
    // RELEASE LOCK
    isInsightRunning = false;
  }
};

module.exports = { runInsightEngine };