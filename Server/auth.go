package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log" // Added log import
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ContextKey is a custom type for context keys to avoid collisions.
type ContextKey string

const userContextKey = ContextKey("user")

// Claims represents the JWT claims.
type Claims struct {
	UserID int    `json:"userId"`
	UID    string `json:"uid"`
	jwt.RegisteredClaims
}

// LoginRequest represents the expected JSON body for the login endpoint.
type LoginRequest struct {
	UID      string `json:"uid"`
	Password string `json:"password"`
}

var jwtKey []byte

// generateJWT creates a new JWT for a given user.
func generateJWT(user User) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: user.ID,
		UID:    user.UID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

// loginHandler handles the POST /api/login route.
func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	user, err := GetUserByUID(req.UID)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	if !user.Password.Valid {
		http.Error(w, `{"success": false, "error": "Password not set for user"}`, http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password.String), []byte(req.Password)); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	tokenString, err := generateJWT(*user)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Could not generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"token": tokenString,
			"user":  user,
		},
	})
}

// authMiddleware protects routes by verifying a JWT.
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("AuthMiddleware hit for %s %s", r.Method, r.URL.Path) // ADDED LOG

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"success": false, "error": "Authorization header required"}`, http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader { // No "Bearer " prefix
			http.Error(w, `{"success": false, "error": "Invalid token format"}`, http.StatusUnauthorized)
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"success": false, "error": "Invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		user, err := GetUserByID(claims.UserID)
		if err != nil {
			http.Error(w, `{"success": false, "error": "User not found"}`, http.StatusUnauthorized)
			return
		}

		// Store user in context
		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// InitAuth initializes the JWT key from environment variables.
func InitAuth() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET environment variable not set")
	}
	jwtKey = []byte(secret)
}
