# auth.py
import jwt
import datetime
import uuid
from config import JWT_SECRET
from db import get_user  # Import from our new db module

def authenticate_user(username, password):
    """Check if username and password are valid by checking the database."""
    user = get_user(username)
    if user and user["password"] == password:
        return user  # Return the full user object on success
    return None

def create_token(subject, role, expires_in=86400):  # Add role to token
    """Create a JWT token for authentication, including the user's role."""
    now = datetime.datetime.utcnow()
    expiry = now + datetime.timedelta(seconds=expires_in)
    
    payload = {
        'sub': subject,
        'role': role,  # Include the role in the token payload
        'iat': now,
        'exp': expiry,
        'jti': str(uuid.uuid4())
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return token

def verify_token(token):
    """Verify and decode a JWT token."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    return payload