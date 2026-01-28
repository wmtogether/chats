import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../Library/Authentication/AuthContext';

const ProtectedRoute: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        // You can show a loading spinner here while checking auth state
        return (
            <div className="bg-background text-on-background h-screen w-full flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="body-medium text-on-surface-variant">Loading...</p>
                </div>
            </div>
        );
    }

    return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
