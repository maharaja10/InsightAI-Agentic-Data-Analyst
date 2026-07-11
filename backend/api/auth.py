import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User

router = APIRouter()

# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY  = os.getenv("SECRET_KEY", "insightai-super-secret-key-change-in-production")
ALGORITHM   = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── Schemas ──────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    display_name: Optional[str]

class UserOut(BaseModel):
    id: int
    email: str
    display_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt directly (bypasses passlib)."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Dependency: decode JWT and return the User ORM object, or raise 401."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account."""
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        display_name=req.display_name or req.email.split("@")[0],
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Account created successfully. Please sign in."}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Validate credentials and return JWT.  Uses OAuth2 form (username = email)."""
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token, user_id=user.id,
        email=user.email, display_name=user.display_name,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user

from fastapi.responses import JSONResponse

@router.put("/update-password")
def update_password(req: UpdatePasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update the current user's password."""
    try:
        if not verify_password(req.current_password, current_user.hashed_password):
            return JSONResponse(status_code=400, content={"success": False, "message": "Current password is incorrect."})
            
        if req.current_password == req.new_password:
            return JSONResponse(status_code=400, content={"success": False, "message": "New password cannot be the same as the current password."})
            
        current_user.hashed_password = hash_password(req.new_password)
        db.commit()
        return {"success": True, "message": "Password updated successfully."}
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "message": "An error occurred while updating the password."})
