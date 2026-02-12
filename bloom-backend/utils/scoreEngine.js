const Couple = require('../models/Couple');

// Helper: Determine Stage based on Score
const getStage = (score) => {
  if (score <= 20) return 'Dry';
  if (score <= 40) return 'Weak';
  if (score <= 60) return 'Growing';
  if (score <= 80) return 'Healthy';
  return 'Bloom';
};

// @desc    Update Couple Score, Stage, and Streak
// @params  coupleId, points (positive/negative), session
const updateCoupleScore = async (coupleId, points, session) => {
  // 1. Fetch Current State
  const couple = await Couple.findById(coupleId).session(session);
  if (!couple) throw new Error('Couple not found');

  // 2. Calculate New Score (Clamped 0-100)
  let newScore = couple.score + points;
  if (newScore > 100) newScore = 100;
  if (newScore < 0) newScore = 0;

  // 3. Update Stage
  couple.score = newScore;
  couple.stage = getStage(newScore);

  // 4. Update Streak & Last Interaction
  const today = new Date();
  const lastDate = couple.lastInteractionDate ? new Date(couple.lastInteractionDate) : null;
  
  // Normalize dates to midnight for comparison
  const todayStr = today.toISOString().split('T')[0];
  const lastStr = lastDate ? lastDate.toISOString().split('T')[0] : null;

  if (lastStr !== todayStr) {
    // It's a new day of interaction
    if (lastDate) {
      // Check if it was yesterday (Streak continues)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastStr === yesterdayStr) {
        couple.streak += 1;
      } else {
        // Break in streak
        couple.streak = 1; // Restarting today
      }
    } else {
      // First ever interaction
      couple.streak = 1;
    }
  }
  // If lastStr === todayStr, do nothing (streak already incremented today)

  // 5. Always Update Interaction Timestamp
  couple.lastInteractionDate = today;

  await couple.save({ session });
  
  return couple;
};

module.exports = { updateCoupleScore };