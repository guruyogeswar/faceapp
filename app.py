# app.py
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import uuid
import requests
import traceback

# Import custom modules
from config import ML_API_BASE_URL
from r2_storage import upload_to_r2, list_objects, get_object_url, delete_from_r2
from db import add_user, get_user, add_album
from auth import create_token, verify_token, authenticate_user

app = Flask(__name__, static_folder='frontend')
CORS(app)

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Static File Serving & Routes ---
@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/event.html')
def event_page():
    return send_from_directory('frontend', 'event.html')

@app.route('/<path:path>')
def serve_static(path):
    if path != "event.html" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory('frontend', path)
    else:
        # Fallback to index for SPA-like behavior or handle 404
        return send_from_directory('frontend', 'index.html')

# --- API Endpoints ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = authenticate_user(username, password)
    if user:
        token = create_token(username, role=user['role'])
        return jsonify({"token": token, "username": username, "role": user['role']})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    if 'username' not in request.form or 'password' not in request.form:
        return jsonify({"error": "Username and password are required."}), 400
    if 'ref_photo' not in request.files:
        return jsonify({"error": "A reference photo is required for signup."}), 400
    username = request.form['username']
    password = request.form['password']
    ref_photo = request.files['ref_photo']
    if not (username and password and ref_photo and allowed_file(ref_photo.filename)):
        return jsonify({"error": "Invalid form data or file type."}), 400
    filename = secure_filename(ref_photo.filename)
    unique_name = f"{uuid.uuid4()}_{filename}"
    local_path = os.path.join(UPLOAD_FOLDER, unique_name)
    ref_photo.save(local_path)
    r2_path = f"user_profiles/{username}/{unique_name}"
    upload_success, public_url = upload_to_r2(local_path, r2_path)
    os.remove(local_path)
    if not upload_success:
        return jsonify({"error": "Could not save reference photo."}), 500
    success, message = add_user(username, password, role="attendee", ref_photo_path=r2_path)
    if not success:
        delete_from_r2(r2_path)
        return jsonify({"error": message}), 409
    return jsonify({"message": "User registered successfully!"}), 201

@app.route('/api/auth/verify', methods=['GET'])
def verify_auth_token():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        payload = verify_token(token)
        return jsonify({"valid": True, "username": payload['sub']})
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 401

@app.route('/api/album/<photographer_username>/<album_id>/share', methods=['GET'])
def get_shareable_link(photographer_username, album_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        verify_token(token)
    except Exception as e:
        return jsonify({"error": "Authentication required to generate share links.", "details": str(e)}), 401
    base_url = request.host_url.rstrip('/')
    share_link = f"{base_url}/event.html?photographer={photographer_username}&album={album_id}"
    return jsonify({"share_link": share_link})

@app.route('/api/create-album', methods=['POST'])
def create_album():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        payload = verify_token(token)
        username = payload['sub']
        if payload.get('role') != 'photographer':
             return jsonify({"error": "Only photographers can create albums."}), 403
    except Exception as e:
        return jsonify({"error": "Authentication failed", "details": str(e)}), 401
    
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({"error": "Missing album name"}), 400
    
    album_display_name = data['name']
    album_id = secure_filename(album_display_name.lower().replace(' ', '-'))
    if not album_id: return jsonify({"error": "Invalid album name"}), 400
    
    add_album(username, album_id, album_display_name)
    
    r2_placeholder_path = f"event_albums/{username}/{album_id}/.placeholder"
    temp_placeholder_file = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_.placeholder")
    with open(temp_placeholder_file, 'w') as f: f.write('')
    upload_success, _ = upload_to_r2(temp_placeholder_file, r2_placeholder_path)
    os.remove(temp_placeholder_file)
    
    if upload_success:
        return jsonify({"message": "Album created successfully", "album": {"id": album_id, "name": album_display_name}}), 201
    else:
        return jsonify({"error": "Failed to create album in storage"}), 500

@app.route('/api/upload-single-file', methods=['POST'])
def upload_single_file_route():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        payload = verify_token(token)
        username = payload['sub']
        if payload.get('role') != 'photographer':
            return jsonify({"error": "Only photographers can upload photos."}), 403
    except Exception as e:
        return jsonify({"error": "Authentication failed", "details": str(e)}), 401
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file_to_upload = request.files['file']
    album_id = request.form.get('album')
    if not album_id: return jsonify({"error": "Album ID is missing"}), 400
    if file_to_upload and allowed_file(file_to_upload.filename):
        original_filename = secure_filename(file_to_upload.filename)
        unique_name = f"{uuid.uuid4()}_{original_filename}"
        local_path = os.path.join(UPLOAD_FOLDER, unique_name)
        file_to_upload.save(local_path)
        r2_path = f"event_albums/{username}/{album_id}/{unique_name}"
        upload_success, public_url = upload_to_r2(local_path, r2_path)
        os.remove(local_path)
        if upload_success:
            return jsonify({"success": True, "name": original_filename, "url": public_url, "id": unique_name}), 200
        else:
            return jsonify({"success": False, "error": "Failed to upload to R2 storage."}), 500
    else:
        return jsonify({"success": False, "error": "File type not allowed or no file submitted."}), 400

@app.route('/api/albums', methods=['GET'])
def get_albums():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        payload = verify_token(token)
        username = payload['sub']
        prefix_to_search = f"event_albums/{username}/"
        album_prefixes = list_objects(prefix_to_search, delimiter="/")
        formatted_albums = []
        if album_prefixes:
            for album_prefix in album_prefixes:
                album_id = album_prefix.rstrip('/').split('/')[-1]
                if not album_id: continue
                all_files = list_objects(album_prefix)
                actual_photos = [obj for obj in all_files if not obj.endswith('/') and not obj.endswith('.placeholder')]
                photo_count = len(actual_photos)
                cover_image_url = get_object_url(actual_photos[0]) if actual_photos else None
                album_data = {"id": album_id, "name": album_id.replace('-', ' ').title(), "cover": cover_image_url, "photo_count": photo_count}
                formatted_albums.append(album_data)
        return jsonify(formatted_albums)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Could not retrieve albums.", "details": str(e)}), 500

@app.route('/api/event/<photographer_username>/<album_id>', methods=['GET'])
def get_event_album_photos(photographer_username, album_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        verify_token(token)
    except Exception:
        return jsonify({"error": "Authentication required."}), 401
    try:
        prefix = f"event_albums/{photographer_username}/{album_id}/"
        photo_keys = list_objects(prefix)
        photos = [{"id": key.split('/')[-1], "url": get_object_url(key), "name": key.split('/')[-1]} for key in photo_keys if not key.endswith('/') and not key.endswith('.placeholder')]
        return jsonify(photos)
    except Exception as e:
        return jsonify({"error": "Could not retrieve event photos.", "details": str(e)}), 500

@app.route('/api/find-my-photos/<photographer_username>/<album_id>', methods=['GET'])
def find_my_photos(photographer_username, album_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        payload = verify_token(token)
        attendee_username = payload['sub']
    except Exception as e:
        return jsonify({"error": "Authentication required.", "details": str(e)}), 401

    try:
        attendee = get_user(attendee_username)
        if not attendee or not attendee.get('ref_photo_path'):
            return jsonify({"error": "Reference photo not found for user."}), 404
        
        ref_photo_url = get_object_url(attendee['ref_photo_path'])
        
        # Download the reference photo from R2 into memory
        response = requests.get(ref_photo_url)
        response.raise_for_status()  # Will raise an error for bad status codes
        ref_photo_bytes = response.content
        
        # Use a consistent, safe filename format for the embeddings file
        embedding_file_name = f"{photographer_username}-{album_id}_embeddings.json"
        
        # This is the ML service endpoint that expects a file upload
        api_endpoint = f"{ML_API_BASE_URL}find_similar_faces/"
        
        # Prepare the multipart/form-data payload
        files_payload = {
            "file": ("reference_image.jpg", ref_photo_bytes, "image/jpeg")
        }
        data_payload = {
            "embedding_file": embedding_file_name
        }
        
        # Call the ML service with the file data
        ml_response = requests.post(api_endpoint, files=files_payload, data=data_payload, timeout=60)
        ml_response.raise_for_status()
        
        return jsonify(ml_response.json()), ml_response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to connect to ML service or download reference photo.", "details": str(e)}), 503
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred while finding matches.", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 8000)))