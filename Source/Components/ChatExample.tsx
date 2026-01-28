// Example component demonstrating UUID and Channel mapping for messages
import React, { useState, useEffect } from 'react';

interface ChatExampleProps {
  thread: any;
}

export default function ChatExample({ thread }: ChatExampleProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Load messages when thread changes
  useEffect(() => {
    // loadMessages();
  }, [thread]);

  const loadMessages = async () => {
    setLoading(true);
    console.log('load messages');
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    console.log('send message');
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">
        Chat:
      </h3>
      
      <div className="text-sm text-gray-600 mb-4">
        <div>Thread ID: </div>
        <div>UUID: </div>
        <div>Channel ID: </div>
        <div>Identifier Used: </div>
        <div>Is UUID: </div>
      </div>

      {loading ? (
        <div className="text-center py-4">Loading messages...</div>
      ) : (
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No messages yet</div>
          ) : (
           <div></div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border rounded"
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}