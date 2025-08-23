# Practice Test Cooldown and Question Cycling Improvements

## Overview

This document describes the major improvements made to the practice test system to fix cooldown logic and implement intelligent question cycling for repeat attempts.

## Key Features Implemented

### 1. Enhanced Cooldown Logic

#### Previous Issues:
- Cooldown logic was not properly checking batch settings
- Users could bypass restrictions when assigned tests through batches
- Inconsistent behavior between individual test settings and batch settings

#### New Implementation:
- **Hierarchical Settings**: Practice test settings provide defaults, but batch settings override them when a user is assigned a test through a batch
- **Proper Batch Integration**: System checks if user is in a batch with the test assigned and applies batch-specific repeat policies
- **Clear Error Messages**: Users receive specific feedback about why they can't retake a test (batch policy vs. test policy vs. cooldown)

#### Logic Flow:
1. Check if user has completed the test before
2. If user is in a batch with this test assigned, batch `allowTestRetakes` setting takes precedence
3. If not in a batch, use practice test's `allowRepeat` setting
4. If repeats are allowed, check cooldown period using `repeatAfterHours` and `enableCooldown` settings
5. Provide detailed feedback including time remaining and next available time

### 2. Question Cycling System

#### The Problem:
- Users always got the same questions (1 to N) on every attempt
- No intelligent distribution of questions from the question bank
- Admin request: implement cycling logic where users get different question sets on repeat attempts

#### New Solution:
The system now implements intelligent question cycling based on attempt number:

#### For a test with 50 questions and 30 questions per test:
- **Attempt 1**: Questions 1-30
- **Attempt 2**: Questions 21-50 
- **Attempt 3**: Questions 1-30 (cycles back)

#### For a test with 60 questions and 30 questions per test:
- **Attempt 1**: Questions 1-30
- **Attempt 2**: Questions 31-60
- **Attempt 3**: Questions 1-30 (cycles back)

#### Algorithm Details:
```javascript
const calculateQuestionRange = (totalQuestions, questionsPerTest, attemptNumber) => {
  // Calculate cycles based on questions per test
  const questionsPerCycle = questionsPerTest;
  const totalCycles = Math.ceil(totalQuestions / questionsPerCycle);
  
  // Get the cycle for this attempt (0-based)
  const cycle = (attemptNumber - 1) % totalCycles;
  
  // Calculate start and end indices
  const startIndex = cycle * questionsPerCycle;
  let endIndex = Math.min(startIndex + questionsPerCycle - 1, totalQuestions - 1);
  
  // Handle edge cases where we don't have enough questions in current cycle
  // Implementation wraps to beginning to ensure user always gets the requested number of questions
}
```

### 3. Database Schema Enhancements

#### TestAttempt Model Updates:
```javascript
// New fields added to testAttempt.model.js
questionStartIndex: { type: Number, default: 0 }, // starting index for this attempt's questions
questionEndIndex: { type: Number, default: 0 },   // ending index for this attempt's questions  
batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }, // batch context if user is in a batch
```

#### Benefits:
- **Auditability**: Track exactly which questions were shown in each attempt
- **Analytics**: Admins can see question usage patterns and cycling behavior
- **Batch Context**: Link attempts to specific batches for better reporting

### 4. API Response Enhancements

#### Enhanced `startPracticeTest` Response:
```javascript
{
  status: 'success',
  data: {
    testAttemptId: '...',
    test: { /* test details */ },
    attemptInfo: {
      attemptNumber: 2,
      questionRange: {
        start: 21,  // 1-based index for UI display
        end: 50,
        total: 50
      },
      isRepeatAttempt: true,
      batchContext: {
        batchName: "Spring 2024 Batch",
        allowsRepeats: true
      }
    },
    resume: false
  }
}
```

#### Enhanced `getAvailablePracticeTests` Response:
```javascript
{
  // ... existing fields
  canTakeTest: false,
  repeatAllowed: false,
  batchContext: {
    batchName: "Spring 2024 Batch", 
    allowsRepeats: false
  },
  nextQuestionRange: {
    start: 31,
    end: 60, 
    total: 60
  },
  hoursRemaining: 12,
  nextAvailableTime: "2024-01-15T10:30:00Z"
}
```

### 5. Frontend Integration

#### Updated TypeScript Interfaces:
- Enhanced `PracticeTest` interface with new fields for batch context and question ranges
- Updated `TestAttempt` interface to include question range tracking
- Improved error handling for cooldown and repeat restriction scenarios

#### Better User Experience:
- Users see which questions they'll get on next attempt
- Clear feedback about batch vs. test-level restrictions
- Detailed cooldown information with time remaining

## Settings Hierarchy

### Priority Order (Highest to Lowest):
1. **Batch Settings** (when user is assigned test through batch)
   - `batch.settings.allowTestRetakes` - overrides test's `allowRepeat`
   
2. **Practice Test Settings** (default behavior)
   - `practiceTest.allowRepeat` - whether repeats are allowed
   - `practiceTest.enableCooldown` - whether cooldown applies
   - `practiceTest.repeatAfterHours` - cooldown duration

3. **Global Defaults**
   - If no specific settings, defaults to no repeats allowed

## Use Cases Covered

### Scenario 1: Batch with No Repeats
- User is in a batch where `allowTestRetakes = false`
- Even if practice test has `allowRepeat = true`, user cannot retake
- Clear message: "This test does not allow repeat attempts as per batch settings."

### Scenario 2: Batch with Repeats Allowed
- User is in a batch where `allowTestRetakes = true`  
- User can retake test according to practice test's cooldown settings
- Cooldown period respects `repeatAfterHours` and `enableCooldown`

### Scenario 3: Individual User (No Batch)
- User not assigned through any batch
- Follows practice test's `allowRepeat` and cooldown settings directly
- Standard cooldown behavior applies

### Scenario 4: Question Cycling Examples
- **50 questions, 30 per test**: 1-30, 21-50, 1-30, 21-50...
- **60 questions, 30 per test**: 1-30, 31-60, 1-30, 31-60...
- **40 questions, 30 per test**: 1-30, 11-40, 1-30, 11-40...

## Administrative Benefits

### For Admins:
1. **Granular Control**: Set different repeat policies per batch vs. global test settings
2. **Question Usage Analytics**: Track which questions are being used and how often
3. **Batch Management**: Override test settings at the batch level for specific cohorts
4. **Audit Trail**: Full visibility into user attempts with question ranges

### For Students:
1. **Variety**: Different questions on repeat attempts encourage more thorough studying
2. **Fairness**: Systematic question distribution ensures comprehensive coverage
3. **Transparency**: Clear information about what questions they'll see next
4. **Clear Expectations**: Upfront information about repeat policies and cooldowns

## Technical Implementation Details

### Key Files Modified:
- `IIFTL Backend/models/testAttempt.model.js` - Enhanced schema with question tracking
- `IIFTL Backend/controllers/practiceTest.controller.js` - Improved cooldown and cycling logic
- `exim-portal-guardian-main/src/services/practiceTestService.ts` - Updated frontend integration

### New Helper Functions:
- `calculateQuestionRange()` - Implements cycling algorithm
- Enhanced batch checking logic in `startPracticeTest()`
- Improved cooldown validation with batch context

### Backward Compatibility:
- All existing functionality preserved
- New fields are optional and default appropriately
- Existing tests continue to work without modification

## Future Enhancements

### Potential Improvements:
1. **Randomization within Cycles**: Randomize question order within each cycle
2. **Adaptive Difficulty**: Adjust question selection based on previous performance
3. **Question Weighting**: Allow admins to weight certain questions higher
4. **Advanced Analytics**: Heat maps showing question usage patterns
5. **Batch-Specific Cooldowns**: Allow different cooldown periods per batch

## Testing Recommendations

### Test Scenarios:
1. **Batch Override Testing**: Verify batch settings override test settings
2. **Question Cycling**: Test all question range calculations with various totals
3. **Edge Cases**: Tests with fewer total questions than questionsPerTest
4. **Cooldown Accuracy**: Verify cooldown calculations with different time zones
5. **API Response Format**: Ensure all new fields are properly returned

### Data Migration:
- Existing test attempts will have default values for new fields
- No data migration required - system handles missing fields gracefully
- Consider running analytics after deployment to validate question distribution

---

*This implementation addresses all requirements in the original specification while maintaining system stability and user experience.*