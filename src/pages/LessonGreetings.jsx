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

function LessonGreetings() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const greetings = [
    'Hello', 'Goodbye', 'Thank You', 'Please', 'Sorry',
    'Good Morning', 'Good Night', 'How are you?', 'Nice to meet you',
    'Yes', 'No', 'Help', 'Welcome', 'Excuse me', 'See you later',
    'Good afternoon', 'Take care', 'My name is', 'What is your name?', 'Friend'
  ];
  
  const [selectedGreeting, setSelectedGreeting] = useState('Hello');
  const [isCompleted, setIsCompleted] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [lockedGreetings, setLockedGreetings] = useState(new Set());

  useEffect(() => {
    checkCompletionStatus();
    loadLessonProgress();
  }, [currentUser]);

  // Hard guard: user must finish Alphabet tiles (A–Z) before accessing Greetings
  useEffect(() => {
    const guard = async () => {
      if (!currentUser) return;
      const alphabetFinished = await canCompleteLesson(currentUser.uid, 'alphabet', 26);
      if (!alphabetFinished) {
        navigate('/lessons/alphabet');
      }
    };
    guard();
  }, [currentUser, navigate]);

  const checkCompletionStatus = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        const lessonsCompleted = profile?.progress?.lessonsCompleted || [];
        
        // Check if any lesson with 'greetings' category is completed
        const hasGreetingsLesson = lessonsCompleted.some(id => 
          id.includes('greetings') || id === 'lesson_greetings' || id.toLowerCase().includes('greetings')
        );
        setIsCompleted(hasGreetingsLesson);
      } catch (error) {
        console.error('Error checking completion status:', error);
      }
    }
  };

  const loadLessonProgress = async () => {
    if (currentUser) {
      try {
        const progress = await getLessonProgress(currentUser.uid, 'greetings');
        setLessonProgress(progress);
        
        // Determine which greetings are locked
        const locked = new Set();
        const lastIndex = progress?.lastViewedIndex ?? -1;
        greetings.forEach((greeting, index) => {
          if (index > lastIndex + 1) {
            locked.add(greeting);
          }
        });
        setLockedGreetings(locked);
      } catch (error) {
        console.error('Error loading lesson progress:', error);
      }
    }
  };

  const handleGreetingClick = async (greeting, index) => {
    if (!currentUser) return;
    
    // Check if greeting is locked
    if (lockedGreetings.has(greeting)) {
      const nextIndex = (lessonProgress?.lastViewedIndex ?? -1) + 1;
      const nextGreeting = greetings[nextIndex] || 'the next greeting';
      alert(`Please view greetings in order. You need to view "${nextGreeting}" first.`);
      return;
    }
    
    // Track progress
    const result = await trackLessonItemProgress(
      currentUser.uid,
      'greetings',
      greeting,
      index,
      greetings.length
    );
    
    if (result.success && result.canView) {
      setSelectedGreeting(greeting);
      // Reload progress to update locked greetings
      await loadLessonProgress();
      // Auto-complete Greetings when all items have been viewed
      if (result.allItemsViewed && !isCompleted) {
        try {
          await markLessonCompletedByCategory(currentUser.uid, 'greetings');
          setIsCompleted(true);
          alert('Lesson complete! +50 points earned!');
        } catch (error) {
          console.error('Error auto-completing greetings lesson:', error);
        }
      }
    } else if (!result.canView) {
      alert(result.message || 'Please view greetings in sequential order.');
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <h1>Lesson: Greetings</h1>
        <p>Learn common sign language greetings and phrases</p>
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
            <strong>Progress: {lessonProgress.viewedItems?.length || 0} / {greetings.length} greetings viewed</strong>
            {!isCompleted && (
              <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                View all greetings in order — the lesson will complete automatically.
              </p>
            )}
          </div>
        )}
        <div className="greeting-grid">
          {greetings.map((greeting, index) => {
            const isLocked = lockedGreetings.has(greeting);
            const isViewed = lessonProgress?.viewedItems?.includes(greeting);
            return (
              <button
                key={greeting}
                className={`greeting-button ${selectedGreeting === greeting ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isViewed ? 'viewed' : ''}`}
                onClick={() => handleGreetingClick(greeting, index)}
                disabled={isLocked}
                title={isLocked ? `View greetings in order. Next: ${greetings[(lessonProgress?.lastViewedIndex ?? -1) + 1] || 'N/A'}` : ''}
              >
                {greeting}
                {isLocked && <span className="lock-icon">🔒</span>}
                {isViewed && !isLocked && <span className="check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="sign-display card">
          <h2>{selectedGreeting}</h2>
          <div className="sign-visual">
            <div className="sign-placeholder">
              👋
              <p>Sign for "{selectedGreeting}"</p>
            </div>
          </div>
          <div className="sign-description">
            <h3>How to sign "{selectedGreeting}"</h3>
            <p>
              This is where the description and instructions for signing "{selectedGreeting}" would appear.
              Practice this gesture in context to improve your conversational skills.
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
            Finish viewing all greetings to complete this lesson.
          </p>
        )}
        <Link to="/lessons/alphabet">
          <button className="secondary">← Back: Alphabet</button>
        </Link>
      </div>
    </div>
  );
}

export default LessonGreetings;
