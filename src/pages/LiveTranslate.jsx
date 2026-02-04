import { useState, useRef, useEffect } from 'react';

function LiveTranslate() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedSign, setDetectedSign] = useState(null);
  const [translationHistory, setTranslationHistory] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState('Camera Ready');
  const [allProbabilities, setAllProbabilities] = useState({});
  
  const holisticRef = useRef(null);
  const cameraRef = useRef(null);
  const drawingUtilsLoadedRef = useRef(false);
  const sequenceRef = useRef([]);
  const isProcessingRef = useRef(false);
  const lastPredictionRef = useRef({ sign: null, count: 0 });
  
  const sequenceLength = 30;
  const predictionIntervalRef = useRef(null);
 // const FLASK_SERVER_URL = 'https://signtify-backend.onrender.com/predict';
 //ngrok
  const FLASK_SERVER_URL = ' https://paneless-unhuman-lorene.ngrok-free.dev/predict';
//OPTION B: LOCAL (Uncomment this if internet fails & run app.py)
  //const FLASK_SERVER_URL = 'http://127.0.0.1:5000/predict';
  const CONFIDENCE_THRESHOLD = 0.50; // 70% confidence required
  const STABILITY_FRAMES = 3; // Must detect same sign 3 times in a row

  // Extract keypoints - EXACTLY like your Jupyter notebook
  const extractKeypoints = (results) => {
    // Pose: 33 landmarks * 4 values (x, y, z, visibility) = 132 values
    const pose = results.poseLandmarks 
      ? results.poseLandmarks.map(res => [res.x, res.y, res.z, res.visibility]).flat() 
      : new Array(33 * 4).fill(0);
    
    // Face: 468 landmarks * 3 values (x, y, z) = 1404 values
    const face = results.faceLandmarks 
      ? results.faceLandmarks.map(res => [res.x, res.y, res.z]).flat() 
      : new Array(468 * 3).fill(0);
    
    // Left hand: 21 landmarks * 3 values = 63 values
    const lh = results.leftHandLandmarks 
      ? results.leftHandLandmarks.map(res => [res.x, res.y, res.z]).flat() 
      : new Array(21 * 3).fill(0);
    
    // Right hand: 21 landmarks * 3 values = 63 values
    const rh = results.rightHandLandmarks 
      ? results.rightHandLandmarks.map(res => [res.x, res.y, res.z]).flat() 
      : new Array(21 * 3).fill(0);
    
    // Total: 132 + 1404 + 63 + 63 = 1662 values
    return [...pose, ...face, ...lh, ...rh];
  };

  // Check if hands are detected in LAST frame (more reliable)
  const hasHandsDetected = (results) => {
    return !!(results.leftHandLandmarks || results.rightHandLandmarks);
  };

  // Prediction loop with stability check
  const predictLoop = async () => {
    const currentSequence = sequenceRef.current;
    
    // Don't predict if already processing
    if (isProcessingRef.current) {
      return;
    }
    
    // Need exactly 30 frames
    if (currentSequence.length !== sequenceLength) {
      setDetectionStatus(`Collecting frames: ${currentSequence.length}/${sequenceLength}`);
      return;
    }
    
    isProcessingRef.current = true;
    setDetectionStatus('Analyzing...');

    try {
      const response = await fetch(FLASK_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: currentSequence }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Prediction:', data);
      
      // Store all probabilities for debugging
      if (data.all_probabilities) {
        setAllProbabilities(data.all_probabilities);
      }

      // Filter out "nothing" if confidence is low
      const predictedSign = data.prediction;
      const conf = data.confidence;

      // Ignore "nothing" predictions unless very confident
      if (predictedSign === 'nothing' && conf < 0.90) {
        setDetectionStatus('Show gesture clearly');
        setDetectedSign(null);
        setConfidence(0);
        return;
      }

      // For real signs, require higher confidence
      if (conf >= CONFIDENCE_THRESHOLD) {
        // Stability check - must be same sign multiple times
        if (lastPredictionRef.current.sign === predictedSign) {
          lastPredictionRef.current.count++;
        } else {
          lastPredictionRef.current = { sign: predictedSign, count: 1 };
        }

        // Only update if stable
        if (lastPredictionRef.current.count >= STABILITY_FRAMES) {
          setDetectedSign(predictedSign);
          setConfidence(Math.round(conf * 100));
          setDetectionStatus('✅ Detected!');
          
          // Add to history (avoid duplicates)
          setTranslationHistory(prev => {
            const lastEntry = prev[0];
            if (lastEntry && lastEntry.sign === predictedSign) {
              return prev; // Don't add duplicate
            }
            return [{
              sign: predictedSign,
              confidence: Math.round(conf * 100),
              time: new Date().toLocaleTimeString()
            }, ...prev].slice(0, 10);
          });
          
          // Reset stability counter after successful detection
          lastPredictionRef.current = { sign: null, count: 0 };
        } else {
          setDetectionStatus(`Stabilizing... (${lastPredictionRef.current.count}/${STABILITY_FRAMES})`);
        }
      } else {
        // Low confidence
        setDetectionStatus(`Low confidence: ${Math.round(conf * 100)}%`);
        setDetectedSign(null);
        setConfidence(Math.round(conf * 100));
        lastPredictionRef.current = { sign: null, count: 0 };
      }

    } catch (error) {
      console.error("❌ Prediction error:", error);
      setDetectionStatus('⚠️ Server offline - Start Flask');
      setDetectedSign(null);
      setConfidence(0);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Load MediaPipe scripts
  const loadMediaPipeScripts = () => {
    return new Promise((resolve, reject) => {
      if (drawingUtilsLoadedRef.current) {
        resolve();
        return;
      }

      const drawingScript = document.createElement('script');
      drawingScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
      drawingScript.crossOrigin = 'anonymous';
      
      drawingScript.onload = () => {
        const cameraScript = document.createElement('script');
        cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
        cameraScript.crossOrigin = 'anonymous';
        
        cameraScript.onload = () => {
          const holisticScript = document.createElement('script');
          holisticScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js';
          holisticScript.crossOrigin = 'anonymous';
          
          holisticScript.onload = () => {
            drawingUtilsLoadedRef.current = true;
            console.log('✅ MediaPipe scripts loaded');
            resolve();
          };
          
          holisticScript.onerror = () => reject(new Error('Failed to load holistic'));
          document.head.appendChild(holisticScript);
        };
        
        cameraScript.onerror = () => reject(new Error('Failed to load camera'));
        document.head.appendChild(cameraScript);
      };
      
      drawingScript.onerror = () => reject(new Error('Failed to load drawing utils'));
      document.head.appendChild(drawingScript);
    });
  };

  // Start camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      setDetectionStatus('Initializing camera...');
      
      await loadMediaPipeScripts();

      // Create holistic with SAME settings as Jupyter
      holisticRef.current = new window.Holistic({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
      });

      holisticRef.current.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // On results callback
      holisticRef.current.onResults((results) => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        
        // Draw mirrored video
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        
        // Draw landmarks
        if (window.drawConnectors && window.drawLandmarks) {
          // Pose
          if (results.poseLandmarks) {
            window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, 
              {color: '#00FF00', lineWidth: 4});
            window.drawLandmarks(ctx, results.poseLandmarks, 
              {color: '#FF0000', lineWidth: 2});
          }
          
          // Face
          if (results.faceLandmarks) {
            window.drawConnectors(ctx, results.faceLandmarks, window.FACEMESH_TESSELATION, 
              {color: '#C0C0C070', lineWidth: 1});
          }
          
          // Left hand
          if (results.leftHandLandmarks) {
            window.drawConnectors(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS, 
              {color: '#CC0000', lineWidth: 5});
            window.drawLandmarks(ctx, results.leftHandLandmarks, 
              {color: '#00FF00', lineWidth: 2});
          }
          
          // Right hand
          if (results.rightHandLandmarks) {
            window.drawConnectors(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS, 
              {color: '#00CC00', lineWidth: 5});
            window.drawLandmarks(ctx, results.rightHandLandmarks, 
              {color: '#FF0000', lineWidth: 2});
          }
        }
        
        ctx.restore();
        
        // Extract keypoints and update sequence
        const keypoints = extractKeypoints(results);
        sequenceRef.current = [...sequenceRef.current, keypoints].slice(-sequenceLength);
        
        // Visual feedback for hands
        if (!hasHandsDetected(results) && sequenceRef.current.length >= sequenceLength) {
          setDetectionStatus('⚠️ No hands detected');
        }
      });

      console.log("✅ MediaPipe Holistic initialized");
      
      // Start camera
      cameraRef.current = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (holisticRef.current && videoRef.current) {
            await holisticRef.current.send({image: videoRef.current});
          }
        },
        width: 640,
        height: 480
      });
      
      await cameraRef.current.start();
      setIsCameraActive(true);
      setDetectionStatus('Collecting frames...');
      console.log("✅ Camera started");
      
      // Start prediction loop (every 500ms = 2 predictions per second)
      if (predictionIntervalRef.current) clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = setInterval(predictLoop, 500);
      
    } catch (error) {
      console.error('❌ Camera error:', error);
      setCameraError(`Unable to start camera: ${error.message}`);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (predictionIntervalRef.current) {
      clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = null;
    }
    if (holisticRef.current) {
      holisticRef.current.close();
      holisticRef.current = null;
    }
    setIsCameraActive(false);
    setDetectionStatus('Camera stopped');
    setDetectedSign(null);
    setConfidence(0);
    sequenceRef.current = [];
    isProcessingRef.current = false;
    lastPredictionRef.current = { sign: null, count: 0 };
  };

  const clearHistory = () => setTranslationHistory([]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#2c3e50' }}>
          Live Hand Gesture Translation
        </h1>
        <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>
          Show your hand gestures to the camera for real-time translation
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Camera Section */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <div style={{ position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden', aspectRatio: '4/3' }}>
              {!isCameraActive && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📷</div>
                  <p style={{ color: 'white', marginBottom: '20px' }}>Camera is off</p>
                  <button onClick={startCamera} style={{ padding: '12px 24px', fontSize: '1rem', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Start Camera
                  </button>
                  {cameraError && (
                    <div style={{ color: '#e74c3c', marginTop: '20px', padding: '10px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '6px' }}>
                      <p>{cameraError}</p>
                    </div>
                  )}
                </div>
              )}
              
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  display: isCameraActive ? 'block' : 'none', 
                  transform: 'scaleX(-1)' 
                }} 
              />
              <canvas 
                ref={canvasRef} 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  display: isCameraActive ? 'block' : 'none' 
                }} 
              />
              
              {isCameraActive && (
                <div style={{ position: 'absolute', top: '15px', left: '15px', background: 'rgba(0,0,0,0.8)', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', animation: 'pulse 2s infinite' }}></span>
                  <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 'bold' }}>{detectionStatus}</span>
                </div>
              )}
            </div>

            {isCameraActive && (
              <div style={{ marginTop: '15px', textAlign: 'center' }}>
                <button onClick={stopCamera} style={{ padding: '10px 20px', fontSize: '1rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Stop Camera
                </button>
              </div>
            )}
          </div>

          {/* Current Detection */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>Current Detection</h3>
            {detectedSign ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '3rem' }}>✋</span>
                  <h2 style={{ fontSize: '2rem', margin: '10px 0', color: '#27ae60', textTransform: 'uppercase' }}>
                    {detectedSign}
                  </h2>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#7f8c8d', fontWeight: 'bold' }}>
                    Confidence: {confidence}%
                  </label>
                  <div style={{ background: '#ecf0f1', borderRadius: '10px', height: '30px', overflow: 'hidden' }}>
                    <div style={{ 
                      background: confidence >= 80 ? 'linear-gradient(90deg, #2ecc71, #27ae60)' : 
                                  confidence >= 60 ? 'linear-gradient(90deg, #f39c12, #e67e22)' :
                                  'linear-gradient(90deg, #e74c3c, #c0392b)',
                      height: '100%', 
                      width: `${confidence}%`, 
                      transition: 'width 0.3s' 
                    }}></div>
                  </div>
                </div>
                
                {/* Show all probabilities for debugging */}
                {Object.keys(allProbabilities).length > 0 && (
                  <details style={{ marginTop: '15px', fontSize: '0.9rem' }}>
                    <summary style={{ cursor: 'pointer', color: '#7f8c8d' }}>All Probabilities</summary>
                    <div style={{ marginTop: '10px' }}>
                      {Object.entries(allProbabilities).map(([sign, prob]) => (
                        <div key={sign} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #ecf0f1' }}>
                          <span>{sign}</span>
                          <span style={{ fontWeight: 'bold' }}>{(prob * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#95a5a6' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '5px' }}>No hand gesture detected</p>
                <span style={{ fontSize: '0.9rem' }}>Show your hand to the camera and hold steady</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Translation History */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>Translation History</h3>
              {translationHistory.length > 0 && (
                <button onClick={clearHistory} style={{ padding: '5px 12px', fontSize: '0.9rem', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {translationHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#95a5a6' }}>
                  <p style={{ marginBottom: '5px' }}>No translations yet</p>
                  <span style={{ fontSize: '0.9rem' }}>Start showing gestures</span>
                </div>
              ) : (
                translationHistory.map((item, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px', 
                      background: index % 2 === 0 ? '#f8f9fa' : 'white', 
                      borderRadius: '6px', 
                      marginBottom: '5px' 
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50', textTransform: 'uppercase' }}>
                        {item.sign}
                      </span>
                      <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#27ae60' }}>
                        {item.confidence}%
                      </span>
                    </div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>{item.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tips */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>💡 Tips</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', lineHeight: '1.8', fontSize: '0.95rem' }}>
              <li>Ensure <strong>good lighting</strong></li>
              <li>Position hand <strong>clearly in frame</strong></li>
              <li>Keep hand <strong>steady for 2-3 seconds</strong></li>
              <li>Avoid cluttered backgrounds</li>
              <li>Wait for "Detected" status</li>
              <li>Min confidence: <strong>70%</strong></li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default LiveTranslate;