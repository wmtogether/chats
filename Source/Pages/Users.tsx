import React, { useEffect, useState } from 'react';
import { apiClient } from '../Library/Authentication/AuthContext';
import { Link } from 'react-router-dom';

interface User {
    id: number;
    uid: string;
    name: string;
    role: string;
}

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await apiClient.get('/users');
                setUsers(response.data.data);
            } catch (err) {
                setError('Failed to fetch users.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return <div className="p-4 text-error">{error}</div>;
    }

    return (
        <div className="p-6 bg-surface-container text-on-surface flex-1 flex-col">
            <h1 className="headline-large mb-4">Users</h1>
            <div className="mb-4">
                <Link to="/" className="text-primary hover:underline">
                    &larr; Back to Chat
                </Link>
            </div>
            <div className="bg-surface rounded-lg p-4 shadow">
                <ul>
                    {users.map(user => (
                        <li key={user.id} className="p-2 border-b border-outline">
                            <p className="font-bold">{user.name} <span className="text-on-surface-variant">({user.uid})</span></p>
                            <p className="text-sm text-on-surface-variant">{user.role}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default UsersPage;
