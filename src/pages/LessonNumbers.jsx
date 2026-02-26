import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  markLessonCompletedByCategory,
  getUserProfile,
  trackLessonItemProgress,
  getLessonProgress,
  canCompleteLesson
} from '../auth/firestoreUtils';
import '../styles/pages/Lesson.css';

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function LessonNumbers() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedNumber, setSelectedNumber] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [lockedNumbers, setLockedNumbers] = useState(new Set());

  useEffect(() => {
    checkCompletionStatus();
    loadLessonProgress();
  }, [currentUser]);

  // Guard: user must complete Greetings before accessing Numbers
  useEffect(() => {
    const guard = async () => {
      if (!currentUser) return;
      const greetingsFinished = await canCompleteLesson(currentUser.uid, 'greetings', 20);
      if (!greetingsFinished) {
        navigate('/lessons/greetings');
      }
    };
    guard();
  }, [currentUser, navigate]);

  const checkCompletionStatus = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        const lessonsCompleted = profile?.progress?.lessonsCompleted || [];
        const hasNumbersLesson = lessonsCompleted.some(id =>
          id.includes('numbers') || id === 'lesson_numbers' || id.toLowerCase().includes('numbers')
        );
        setIsCompleted(hasNumbersLesson);
      } catch (error) {
        console.error('Error checking completion status:', error);
      }
    }
  };

  const loadLessonProgress = async () => {
    if (currentUser) {
      try {
        const progress = await getLessonProgress(currentUser.uid, 'numbers');
        setLessonProgress(progress);
        const locked = new Set();
        const lastIndex = progress?.lastViewedIndex ?? -1;
        NUMBERS.forEach((num, index) => {
          if (index > lastIndex + 1) locked.add(num);
        });
        setLockedNumbers(locked);
      } catch (error) {
        console.error('Error loading lesson progress:', error);
      }
    }
  };

  const handleNumberClick = async (num, index) => {
    if (!currentUser) return;
    if (lockedNumbers.has(num)) {
      const nextNum = NUMBERS[(lessonProgress?.lastViewedIndex ?? -1) + 1];
      alert(`Please view numbers in order. View ${nextNum} first.`);
      return;
    }
    const result = await trackLessonItemProgress(
      currentUser.uid,
      'numbers',
      String(num),
      index,
      NUMBERS.length
    );
    if (result.success && result.canView) {
      setSelectedNumber(num);
      await loadLessonProgress();
      if (result.allItemsViewed && !isCompleted) {
        try {
          await markLessonCompletedByCategory(currentUser.uid, 'numbers');
          setIsCompleted(true);
          alert('🎉 Numbers lesson complete! +50 points earned!');
        } catch (error) {
          console.error('Error auto-completing numbers lesson:', error);
        }
      }
    } else if (!result.canView) {
      alert(result.message || 'Please view numbers in sequential order.');
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <h1>Lesson: Numbers</h1>
        <p>Learn to sign numbers 1–10 in ASL</p>
      </div>

      <div className="lesson-content">
        {lessonProgress && (
          <div className="lesson-progress-indicator" style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: '#f0f0f0',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <strong>Progress: {lessonProgress.viewedItems?.length || 0} / {NUMBERS.length} numbers viewed</strong>
            {!isCompleted && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                View all numbers 1–10 in order — the lesson will complete automatically.
              </p>
            )}
          </div>
        )}
        <div className="letter-grid">
          {NUMBERS.map((num, index) => {
            const isLocked = lockedNumbers.has(num);
            const isViewed = lessonProgress?.viewedItems?.includes(String(num));
            return (
              <button
                key={num}
                className={`letter-button ${selectedNumber === num ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleNumberClick(num, index)}
                disabled={isLocked}
                title={isLocked ? `View in order. Next: ${NUMBERS[(lessonProgress?.lastViewedIndex ?? -1) + 1]}` : ''}
              >
                {num}
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="sign-display card">
          <h2>Number: {selectedNumber}</h2>
          <div className="sign-visual">
            <div className="sign-placeholder">
              <span className="sign-placeholder-emoji">🔢</span>
              <p>Sign for "{selectedNumber}"</p>
            </div>
          </div>
          <div className="sign-description">
            <h3>How to sign "{selectedNumber}"</h3>
            <p>
              This is where the description and instructions for signing the number "{selectedNumber}" would appear.
              Practice counting in sign language to build fluency.
            </p>
          </div>
        </div>
      </div>

      <div className="lesson-actions">
        {isCompleted && (
          <div className="completion-badge" style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            ✓ Lesson Completed!
          </div>
        )}
        {!isCompleted && (
          <p style={{ marginBottom: '10px', color: '#666', fontSize: '0.9rem' }}>
            Finish viewing all numbers 1–10 to complete this lesson.
          </p>
        )}
        <Link to="/lessons/greetings">
          <button className="secondary">← Back: Greetings</button>
        </Link>
      </div>
    </div>
  );
}

export default LessonNumbers;
