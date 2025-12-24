// Example component demonstrating UUID and Channel mapping for messages
import React, { useState, useEffect } from 'react';
import { messagesApiService } from '../Library/Shared/messagesApi';
import type { MessageData } from '../Library/Shared/messagesApi';
import type { Thread } from '../Library/Shared/threadsApi';

interface ChatExampleProps {
  thread: Thread;
}

export default function ChatExample({ thread }: ChatExampleProps) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Load messages when thread changes
  useEffect(() => {
    loadMessages();
  }, [thread]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      // The API automatically handles UUID vs channelId mapping
      const identifier = messagesApiService.getMessageIdentifier(thread);
      
      console.log('Loading messages for:', {
        threadId: thread.id,
        uuid: thread.uuid,
        channelId: thread.channelId,
        identifier: identifier,
        isUuid: messagesApiService.isUuid(identifier)
      });

      const response = await messagesApiService.getMessages(identifier, { limit: 50 });
      setMessages(response.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const identifier = messagesApiService.getMessageIdentifier(thread);
      const response = await messagesApiService.sendMessage(identifier, {
        content: newMessage
      });

      if (response.success) {
        setMessages(prev => [...prev, response.message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">
        Chat: {thread.channelName}
      </h3>
      
      <div className="text-sm text-gray-600 mb-4">
        <div>Thread ID: {thread.id}</div>
        <div>UUID: {thread.uuid}</div>
        <div>Channel ID: {thread.channelId}</div>
        <div>Identifier Used: {messagesApiService.getMessageIdentifier(thread)}</div>
        <div>Is UUID: {messagesApiService.isUuid(messagesApiService.getMessageIdentifier(thread)) ? 'Yes' : 'No'}</div>
      </div>

      {loading ? (
        <div className="text-center py-4">Loading messages...</div>
      ) : (
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No messages yet</div>
          ) : (
            messages.map((message) => (
              <div key={message.messageId} className="p-2 bg-gray-50 rounded">
                <div className="font-medium text-sm">{message.userName}</div>
                <div className="text-sm">{message.content}</div>
                <div className="text-xs text-gray-500">
                  {new Date(message.createdAt).toLocaleString()}
                </div>
              </div>
            ))
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