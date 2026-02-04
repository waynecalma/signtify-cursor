import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { 
  markLessonCompletedByCategory, 
  getUserProfile, 
  trackLessonItemProgress, 
  getLessonProgress,
  canCompleteLesson 
} from '../auth/firestoreUtils';
import '../styles/pages/Lesson.css';

function LessonAlphabet() {
  const { currentUser } = useAuth();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const [selectedLetter, setSelectedLetter] = useState('A');
  const [isCompleted, setIsCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [lockedLetters, setLockedLetters] = useState(new Set());

  useEffect(() => {
    checkCompletionStatus();
    loadLessonProgress();
  }, [currentUser]);

  const checkCompletionStatus = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        const lessonsCompleted = profile?.progress?.lessonsCompleted || [];
        
        // Check if any lesson with 'alphabet' category is completed
        const hasAlphabetLesson = lessonsCompleted.some(id => 
          id.includes('alphabet') || id === 'lesson_alphabet' || id.toLowerCase().includes('alphabet')
        );
        setIsCompleted(hasAlphabetLesson);
      } catch (error) {
        console.error('Error checking completion status:', error);
      }
    }
  };

  const loadLessonProgress = async () => {
    if (currentUser) {
      try {
        const progress = await getLessonProgress(currentUser.uid, 'alphabet');
        setLessonProgress(progress);
        
        // Determine which letters are locked
        const locked = new Set();
        const lastIndex = progress?.lastViewedIndex ?? -1;
        alphabet.forEach((letter, index) => {
          if (index > lastIndex + 1) {
            locked.add(letter);
          }
        });
        setLockedLetters(locked);
      } catch (error) {
        console.error('Error loading lesson progress:', error);
      }
    }
  };

  const handleLetterClick = async (letter, index) => {
    if (!currentUser) return;
    
    // Check if letter is locked
    if (lockedLetters.has(letter)) {
      alert(`Please view letters in order. You need to view all letters from A to ${String.fromCharCode(letter.charCodeAt(0) - 1)} first.`);
      return;
    }
    
    // Track progress
    const result = await trackLessonItemProgress(
      currentUser.uid,
      'alphabet',
      letter,
      index,
      alphabet.length
    );
    
    if (result.success && result.canView) {
      setSelectedLetter(letter);
      // Reload progress to update locked letters
      await loadLessonProgress();

      // If all letters have been viewed, auto-complete the lesson (first time only)
      if (result.allItemsViewed && !isCompleted) {
        try {
          await markLessonCompletedByCategory(currentUser.uid, 'alphabet');
          setIsCompleted(true);
          alert(
            '🎉 Congratulations! You\'ve completed the Alphabet lesson.\n\n' +
            'You have unlocked the Alphabet Mini Quiz and Proficiency Exam.\n\n' +
            '+50 points earned!'
          );
        } catch (error) {
          console.error('Error auto-completing alphabet lesson:', error);
        }
      }
    } else if (!result.canView) {
      alert(result.message || 'Please view letters in sequential order.');
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <h1>Lesson: Alphabet</h1>
        <p>Learn the sign language alphabet from A to Z</p>
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
            <strong>Progress: {lessonProgress.viewedItems?.length || 0} / {alphabet.length} letters viewed</strong>
            {!isCompleted && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                View all letters from A to Z in order — the lesson will complete automatically.
              </p>
            )}
          </div>
        )}
        <div className="letter-grid">
          {alphabet.map((letter, index) => {
            const isLocked = lockedLetters.has(letter);
            const isViewed = lessonProgress?.viewedItems?.includes(letter);
            return (
              <button
                key={letter}
                className={`letter-button ${selectedLetter === letter ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleLetterClick(letter, index)}
                disabled={isLocked}
                title={isLocked ? `View letters in order. Next: ${String.fromCharCode(65 + (lessonProgress?.lastViewedIndex ?? -1) + 1)}` : ''}
              >
                {letter}
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="sign-display card">
          <h2>Letter: {selectedLetter}</h2>
          <div className="sign-visual">
            <div className="sign-placeholder">
              {selectedLetter === 'A' ? (
                <img src="/asl/A.svg" alt="Sign for A" className="sign-letter-a-svg" />
              ) : (
                <span className="sign-placeholder-emoji">✋</span>
              )}
              <p>Sign for "{selectedLetter}"</p>
            </div>
          </div>
          <div className="sign-description">
            <h3>How to sign "{selectedLetter}"</h3>
            <p>
              This is where the description and instructions for signing the letter "{selectedLetter}" would appear.
              Practice this gesture slowly and carefully to build muscle memory.
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
            Finish viewing all letters A–Z to unlock the next lesson.
          </p>
        )}
        {isCompleted ? (
          <Link to="/lessons/greetings">
          <button className="secondary">Next: Greetings →</button>
          </Link>
        ) : (
          <button
            className="secondary"
            disabled
            style={{ opacity: 0.7, cursor: 'not-allowed' }}
            title="Finish viewing all letters A–Z to unlock the next lesson"
          >
            🔒 Next: Greetings
          </button>
        )}
      </div>
    </div>
  );
}

export default LessonAlphabet;
