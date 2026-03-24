from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_db,
    get_current_user,
    validate_email_format,
    validate_password_strength,
    get_password_strength_label,
)
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, Token
from app.utils.security import get_password_hash, verify_password, create_access_token

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user account.
    - Email is validated for format
    - Password is checked for strength (min 8 chars, upper, lower, digit, special)
    - Duplicate email and username are rejected
    """
    # Validate and clean email
    cleaned_email = validate_email_format(user.email)

    # Enforce password strength
    validate_password_strength(user.password)

    # Check if email already registered
    if db.query(User).filter(User.email == cleaned_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )

    # Check if username taken
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken.",
        )

    # Create user
    new_user = User(
        username=user.username,
        email=cleaned_email,
        hashed_password=get_password_hash(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post(
    "/login",
    response_model=Token,
    summary="Login with username or email",
)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Login with either username or email plus password.
    Returns a JWT access token.
    """
    user = db.query(User).filter(
        (User.email == form_data.username) | (User.username == form_data.username)
    ).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the profile of the currently authenticated user.
    Requires a valid JWT token in the Authorization header.
    """
    return current_user


@router.post(
    "/password-strength",
    summary="Check password strength without registering",
)
def check_password_strength(password: str):
    """
    Returns a strength score and suggestions for the given password.
    Use this for live frontend feedback as the user types.
    Score: 0=Weak, 1=Fair, 2=Good, 3=Strong, 4=Very Strong
    """
    return get_password_strength_label(password)