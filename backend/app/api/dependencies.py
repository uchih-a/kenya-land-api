from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
import jwt
import re

from app.database import SessionLocal
from app.models.user import User
from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)
ALGORITHM = "HS256"

# Common weak passwords — reject these regardless of complexity score
COMMON_PASSWORDS = {
    "password", "password1", "password123", "123456", "12345678",
    "qwerty", "abc123", "letmein", "welcome", "monkey", "dragon",
    "master", "sunshine", "princess", "shadow", "superman", "football",
}


# ── DB Session ────────────────────────────────────────────────────────────────

def get_db():
    """Single source of truth for DB sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Email Validation ──────────────────────────────────────────────────────────

def validate_email_format(email: str) -> str:
    """
    Validate email format. Returns cleaned email or raises 422.
    Checks: basic RFC format, no consecutive dots, valid TLD length.
    """
    email = email.strip().lower()

    # Basic RFC 5322 pattern
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid email address format.",
        )

    # No consecutive dots
    if ".." in email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email address cannot contain consecutive dots.",
        )

    # Local part (before @) must be between 1 and 64 characters
    local_part = email.split("@")[0]
    if len(local_part) < 1 or len(local_part) > 64:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email local part must be between 1 and 64 characters.",
        )

    return email


# ── Password Strength ─────────────────────────────────────────────────────────

def validate_password_strength(password: str) -> None:
    """
    Enforce password policy based on OWASP ASVS v4 + NIST SP 800-63B.
    Raises 422 with a descriptive message if the password fails any check.

    Rules:
    - Minimum 8 characters
    - Maximum 128 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    - Not in the common passwords list
    - No more than 3 consecutive identical characters (e.g. 'aaaa')
    """
    errors = []

    if len(password) < 8:
        errors.append("at least 8 characters")

    if len(password) > 128:
        errors.append("no more than 128 characters")

    if not re.search(r'[A-Z]', password):
        errors.append("at least one uppercase letter (A-Z)")

    if not re.search(r'[a-z]', password):
        errors.append("at least one lowercase letter (a-z)")

    if not re.search(r'\d', password):
        errors.append("at least one number (0-9)")

    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~\';\s]', password):
        errors.append("at least one special character (!@#$%^&* etc.)")

    if password.lower() in COMMON_PASSWORDS:
        errors.append("password is too common — choose something more unique")

    # No more than 3 consecutive identical characters
    if re.search(r'(.)\1{3,}', password):
        errors.append("no more than 3 consecutive identical characters (e.g. 'aaaa')")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password must contain: {', '.join(errors)}.",
        )


def get_password_strength_label(password: str) -> dict:
    """
    Returns a strength score and label without raising errors.
    Used by the /password-strength endpoint so the frontend
    can show live feedback as the user types.

    Score: 0-4
    Label: Weak / Fair / Good / Strong / Very Strong
    """
    score = 0

    if len(password) >= 8:  score += 1
    if len(password) >= 12: score += 1
    if re.search(r'[A-Z]', password): score += 1
    if re.search(r'[a-z]', password): score += 1
    if re.search(r'\d', password):    score += 1
    if re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~\';\s]', password): score += 1
    if password.lower() in COMMON_PASSWORDS: score = max(0, score - 2)

    # Normalise to 0-4
    score = min(4, max(0, score - 1))

    labels = {0: "Weak", 1: "Fair", 2: "Good", 3: "Strong", 4: "Very Strong"}
    colors = {0: "#e53e3e", 1: "#dd6b20", 2: "#d69e2e", 3: "#38a169", 4: "#2b6cb0"}

    return {
        "score": score,
        "label": labels[score],
        "color": colors[score],
        "suggestions": _get_suggestions(password),
    }


def _get_suggestions(password: str) -> list[str]:
    """Return actionable suggestions for improving a weak password."""
    suggestions = []
    if len(password) < 12:
        suggestions.append("Use at least 12 characters for a stronger password.")
    if not re.search(r'[A-Z]', password):
        suggestions.append("Add uppercase letters.")
    if not re.search(r'[a-z]', password):
        suggestions.append("Add lowercase letters.")
    if not re.search(r'\d', password):
        suggestions.append("Add numbers.")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        suggestions.append("Add special characters like !@#$%.")
    if password.lower() in COMMON_PASSWORDS:
        suggestions.append("This password is too common. Choose something unique.")
    return suggestions


# ── JWT Auth ──────────────────────────────────────────────────────────────────

def _decode_token(token: str) -> int:
    """Decode JWT and return user_id. Raises 401 on any failure."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exception


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Require a valid JWT. Returns the correct authenticated user."""
    user_id = _decode_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    return user


async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return user if valid token provided, else None. No error on missing token."""
    if token is None:
        return None
    try:
        user_id = _decode_token(token)
        return db.query(User).filter(
            User.id == user_id, User.is_active == True
        ).first()
    except HTTPException:
        return None