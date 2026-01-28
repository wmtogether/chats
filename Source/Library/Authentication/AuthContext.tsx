import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';

// Define the shape of the user object and auth state
interface User {
    id: number;
    uid: string;
    name: string;
    role: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    login: (uid: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

// Create the context with a default undefined value
const AuthContext = createContext<AuthState | undefined>(undefined);

// Define the props for the AuthProvider
interface AuthProviderProps {
    children: ReactNode;
}

// Create a configured axios instance for API calls
export const apiClient = axios.create({
    baseURL: '/api' // Uses the Vite proxy
});

// Use an interceptor to add the auth token to every request
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);


export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verifyToken = async () => {
            if (token) {
                try {
                    const response = await apiClient.get('/auth/me');
                    setUser(response.data.data);
                } catch (error) {
                    console.error("Session expired or invalid, logging out.");
                    setToken(null);
                    localStorage.removeItem('authToken');
                }
            }
            setLoading(false);
        };

        verifyToken();
    }, [token]);

    const login = async (uid: string, password: string) => {
        const response = await apiClient.post('/login', { uid, password });
        const { token, user } = response.data.data;

        localStorage.setItem('authToken', token);
        setToken(token);
        setUser(user);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
