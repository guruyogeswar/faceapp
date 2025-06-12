# db.py
import json
import os
from threading import Lock

DB_FILE = 'database.json'
db_lock = Lock()

def load_db():
    """Loads the database from the JSON file."""
    with db_lock:
        if not os.path.exists(DB_FILE):
            # Create a default database structure if it doesn't exist
            return {"users": {}, "albums": {}}
        with open(DB_FILE, 'r') as f:
            return json.load(f)

def save_db(data):
    """Saves the entire database to the JSON file."""
    with db_lock:
        with open(DB_FILE, 'w') as f:
            json.dump(data, f, indent=4)

def get_user(username):
    """Retrieves a user from the database."""
    db = load_db()
    return db['users'].get(username)

def add_user(username, password, role, ref_photo_path):
    """Adds a new user to the database and saves it."""
    db = load_db()
    if username in db['users']:
        return False, "Username already exists."
    
    db['users'][username] = {
        "password": password,
        "role": role,
        "ref_photo_path": ref_photo_path
    }
    save_db(db)
    return True, "User added successfully."

def add_album(photographer_username, album_id, album_name):
    """Adds a new album to the database."""
    db = load_db()
    if photographer_username not in db['albums']:
        db['albums'][photographer_username] = {}
    
    if album_id in db['albums'][photographer_username]:
        return False, "Album ID already exists for this photographer."

    db['albums'][photographer_username][album_id] = {
        "name": album_name,
        "photos": [] 
    }
    save_db(db)
    return True, "Album created successfully."