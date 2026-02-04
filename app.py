import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import os

# --- Setup the Server ---
app = Flask(__name__)
CORS(app)

# --- Load Model from Separate Files ---
print(" * Loading Keras model... Please wait.")

actions = np.array(['nothing', 'hello', 'thanks', 'iloveyou', 'yes', 'no'])

try:
    # METHOD 1: Load from separate files (most compatible)
    if os.path.exists('model_architecture.json') and os.path.exists('model_weights_only.h5'):
        print(" * Loading from separate files (architecture + weights)...")
        
        import json
        from tensorflow.keras.models import Model
        from tensorflow.keras.layers import Input, GRU, Dense, Dropout, BatchNormalization
        
        # Manually rebuild the architecture (avoids JSON compatibility issues)
        print(" * Building model architecture...")
        input_layer = Input(shape=(30, 1662), name='input_3')
        
        # GRU layers with BatchNorm and Dropout
        x = GRU(128, return_sequences=True, activation='relu', name='gru_6')(input_layer)
        x = BatchNormalization(name='batch_normalization')(x)
        x = Dropout(0.3, name='dropout')(x)
        
        x = GRU(256, return_sequences=True, activation='relu', name='gru_7')(x)
        x = BatchNormalization(name='batch_normalization_1')(x)
        x = Dropout(0.3, name='dropout_1')(x)
        
        x = GRU(128, return_sequences=False, activation='relu', name='gru_8')(x)
        x = BatchNormalization(name='batch_normalization_2')(x)
        x = Dropout(0.3, name='dropout_2')(x)
        
        # Dense layers
        x = Dense(128, activation='relu', name='dense_6')(x)
        x = Dropout(0.4, name='dropout_3')(x)
        x = Dense(64, activation='relu', name='dense_7')(x)
        x = Dropout(0.4, name='dropout_4')(x)
        output_layer = Dense(6, activation='softmax', name='dense_8')(x)
        
        model = Model(inputs=input_layer, outputs=output_layer)
        print(" * ✅ Architecture built")
        
        # Load weights
        print(" * Loading weights...")
        model.load_weights('model_weights_only.h5')
        print(" * ✅ Weights loaded")
    
    # METHOD 2: Try loading complete model with compile=False
    elif os.path.exists('best_sign_language_model.h5'):
        print(" * Loading complete model (compile=False)...")
        from tensorflow.keras.models import load_model
        
        # Custom objects to handle compatibility
        custom_objects = {
            'GRU': GRU,
            'BatchNormalization': BatchNormalization,
            'Dropout': Dropout,
            'Dense': Dense
        }
        
        model = load_model('best_sign_language_model.h5', 
                          compile=False, 
                          custom_objects=custom_objects)
        print(" * ✅ Model loaded")
    
    else:
        raise FileNotFoundError("No model files found!")
    
    print(" * ✅✅ Model ready! Server is running at http://127.0.0.1:5000/")
    print(f" * Model expects input shape: (None, 30, 1662)")
    print(f" * Actions: {actions}")

except Exception as e:
    print(f" * ❌ Error loading model: {e}")
    print(f" * Error type: {type(e).__name__}")
    
    print("\n" + "="*60)
    print("🔧 TROUBLESHOOTING:")
    print("="*60)
    
    if 'time_major' in str(e) or 'keyword' in str(e):
        print("⚠️  TensorFlow version compatibility issue detected!")
        print("\n💡 Solution: Export model with compatible format")
        print("\nIn your Jupyter Notebook, run:")
        print("-" * 60)
        print("# Save weights only (no compatibility issues)")
        print("model.save_weights('model_weights_only.h5')")
        print("\n# Verify files exist:")
        print("import os")
        print("print('Weights file:', os.path.exists('model_weights_only.h5'))")
        print("-" * 60)
        print("\nThen copy 'model_weights_only.h5' to Flask folder")
        print("(You already have model_architecture.json)")
    else:
        print("\n📋 Required files:")
        print("   ✅ model_weights_only.h5 (REQUIRED)")
        print("   ✅ model_architecture.json (you have this)")
        print("\nOr:")
        print("   best_sign_language_model.h5")
    
    print("\n" + "="*60)
    exit(1)

# --- Create the API Endpoint ---
@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get the 30-frame sequence from the browser
        data = request.json
        
        if not data or 'sequence' not in data:
            return jsonify({'error': 'No sequence data provided'}), 400
        
        sequence = data['sequence']
        
        # Validate sequence
        if len(sequence) != 30:
            return jsonify({'error': f'Expected 30 frames, got {len(sequence)}'}), 400
        
        if len(sequence[0]) != 1662:
            return jsonify({'error': f'Expected 1662 features per frame, got {len(sequence[0])}'}), 400

        # Convert to numpy array
        sequence_array = np.array(sequence, dtype=np.float32)
        sequence_input = np.expand_dims(sequence_array, axis=0)  # (1, 30, 1662)

        # Predict
        res = model.predict(sequence_input, verbose=0)[0]

        # Get results
        prediction_index = np.argmax(res)
        prediction_sign = actions[prediction_index]
        confidence = float(res[prediction_index])

        # Prepare response
        response = {
            'prediction': prediction_sign, 
            'confidence': confidence,
            'all_probabilities': {
                actions[i]: float(res[i]) for i in range(len(actions))
            }
        }
        
        # Log prediction
        print(f"📊 Prediction: {prediction_sign} ({confidence*100:.1f}%)")
        
        return jsonify(response)

    except Exception as e:
        print(f"❌ Error during prediction: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'actions': actions.tolist()
    })

# --- Start the Server ---
if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Flask Server Starting...")
    print("="*60)
    print("📍 Endpoints:")
    print("   POST http://127.0.0.1:5000/predict")
    print("   GET  http://127.0.0.1:5000/health")
    print("="*60 + "\n")
    
    app.run(debug=True, port=5000, use_reloader=False)