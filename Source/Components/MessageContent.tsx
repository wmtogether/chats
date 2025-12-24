import React from 'react';
import { QueueStatusUpdateCard } from './MetaCards/QueueStatusUpdateCard';
import { QueueAcceptedCard } from './MetaCards/QueueAcceptedCard';
import { QueuePreviewCard } from './MetaCards/QueuePreviewCard';
import { FileCheckCard } from './MetaCards/FileCheckCard';
import { ReqTypeChangeCard } from './MetaCards/ReqTypeChangeCard';

interface MessageContentProps {
  content: string;
  messageId?: string;
  timestamp?: string;
  userName?: string;
  searchQuery?: string;
}

interface MessageData {
  id: string;
  timestamp: string;
  userName: string;
}

export function MessageContent({ 
  content, 
  messageId, 
  timestamp, 
  userName, 
  searchQuery 
}: MessageContentProps) {
  const normalizedQuery = searchQuery?.trim().toLowerCase();

  // Create message object for meta cards that need it
  const message: MessageData | undefined = messageId && timestamp && userName ? {
    id: messageId,
    timestamp,
    userName
  } : undefined;

  // Detect queue status update format: [QUEUE_STATUS_UPDATE|queueId|oldStatus|newStatus|customerName]QueueName
  // Also support old format without customerName: [QUEUE_STATUS_UPDATE|queueId|oldStatus|newStatus]QueueName
  const statusUpdateRegex = /^\[QUEUE_STATUS_UPDATE\|(\d+)\|([A-Z_]+)\|([A-Z_]+)(?:\|([^\]]*))?\](.+)$/;
  const statusMatch = content.match(statusUpdateRegex);

  if (statusMatch && message) {
    const [, queueId, oldStatus, newStatus, customerName, queueName] = statusMatch;
    return (
      <QueueStatusUpdateCard
        queueId={parseInt(queueId, 10)}
        queueName={queueName}
        oldStatus={oldStatus}
        newStatus={newStatus}
        timestamp={message.timestamp}
        userName={message.userName}
        customerName={customerName || null}
      />
    );
  }

  // Detect queue request type change format: [QUEUE_REQTYPE_CHANGE|queueId|oldType|newType|customerName]QueueName
  // Also support old format without customerName: [QUEUE_REQTYPE_CHANGE|queueId|oldType|newType]QueueName
  const reqTypeChangeRegex = /^\[QUEUE_REQTYPE_CHANGE\|(\d+)\|([a-z-]+)\|([a-z-]+)(?:\|([^\]]*))?\](.+)$/;
  const reqTypeMatch = content.match(reqTypeChangeRegex);

  if (reqTypeMatch && message) {
    const [, queueId, oldType, newType, customerName, jobName] = reqTypeMatch;
    return (
      <ReqTypeChangeCard
        queueId={queueId}
        jobName={jobName}
        oldType={oldType}
        newType={newType}
        customerName={customerName || null}
      />
    );
  }

  // Detect queue accepted format: [QUEUE_ACCEPTED|queueId|userName|profilePicture|customerName]JobName
  // Also support old format without customerName: [QUEUE_ACCEPTED|queueId|userName|profilePicture]JobName
  const queueAcceptedRegex = /^\[QUEUE_ACCEPTED\|(\d+)\|([^|]+)\|([^|]*)(?:\|([^\]]*))?\](.+)$/;
  const queueAcceptedMatch = content.match(queueAcceptedRegex);

  if (queueAcceptedMatch) {
    const [, queueId, userName, userProfilePicture, customerName, jobName] = queueAcceptedMatch;
    return (
      <QueueAcceptedCard
        queueId={queueId}
        jobName={jobName}
        userName={userName}
        userProfilePicture={userProfilePicture || null}
        customerName={customerName || null}
      />
    );
  }

  // Detect file check card format: [คำขอ #123: Job Name (checkfile)](/works/queue)
  const fileCheckRegex = /^\[คำขอ #(\d+): (.+?) \(checkfile\)\]\(\/works\/queue\)$/;
  const fileCheckMatch = content.match(fileCheckRegex);

  if (fileCheckMatch) {
    const [, queueId, jobName] = fileCheckMatch;
    return (
      <FileCheckCard
        queueId={queueId}
        jobName={jobName}
      />
    );
  }

  // Detect queue links: [คำขอ #123: Job Name (requestType)](/works/queue)
  const queueLinkRegex = /\[คำขอ #(\d+):.+?\]\(\/works\/queue\)/g;
  const queueMatches: Array<{ index: number; queueId: string; fullMatch: string }> = [];
  let match;
  
  while ((match = queueLinkRegex.exec(content)) !== null) {
    queueMatches.push({
      index: match.index,
      queueId: match[1],
      fullMatch: match[0],
    });
  }

  // Detect job links: [งาน #123](/works/proof?jobId=123) or [งาน #123](/works/design/123)
  const jobLinkRegex = /\[งาน #(\d+)[^\]]*\]\(\/works\/(?:proof|design)\?jobId=(\d+)\)/g;
  const jobMatches: Array<{ index: number; jobId: string; fullMatch: string }> = [];
  
  while ((match = jobLinkRegex.exec(content)) !== null) {
    jobMatches.push({
      index: match.index,
      jobId: match[2],
      fullMatch: match[0],
    });
  }

  // Detect design links: [ออกแบบ #WMT-DN-123](/works/design/123)
  const designLinkRegex = /\[ออกแบบ #([^\]]+)\]\(\/works\/design\/(\d+)\)/g;
  const designMatches: Array<{ index: number; designId: string; fullMatch: string }> = [];
  
  while ((match = designLinkRegex.exec(content)) !== null) {
    designMatches.push({
      index: match.index,
      designId: match[2],
      fullMatch: match[0],
    });
  }

  // Combine and sort all matches
  const allMatches = [
    ...queueMatches.map(m => ({ ...m, type: 'queue' as const })),
    ...jobMatches.map(m => ({ ...m, type: 'job' as const })),
    ...designMatches.map(m => ({ ...m, type: 'design' as const })),
  ].sort((a, b) => a.index - b.index);

  // If we have matches, render with preview cards
  if (allMatches.length > 0) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    allMatches.forEach((match, i) => {
      // Add text before this match
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        if (textBefore.trim()) {
          parts.push(
            <span key={`text-${i}`}>
              {renderTextWithHighlight(textBefore, `before-${i}`, normalizedQuery)}
            </span>
          );
        }
      }

      // Add preview card
      if (match.type === 'queue') {
        parts.push(
          <div key={`queue-${i}`} className="my-2">
            <QueuePreviewCard queueId={(match as any).queueId} />
          </div>
        );
      } else if (match.type === 'job') {
        parts.push(
          <div key={`job-${i}`} className="my-2 p-3 rounded-lg bg-surface-variant/30 border border-outline/30">
            <span className="body-small text-on-surface-variant">
              🔗 งาน #{(match as any).jobId} (ลิงก์ไปยังระบบ ERP)
            </span>
          </div>
        );
      } else if (match.type === 'design') {
        parts.push(
          <div key={`design-${i}`} className="my-2 p-3 rounded-lg bg-surface-variant/30 border border-outline/30">
            <span className="body-small text-on-surface-variant">
              🎨 ออกแบบ #{(match as any).designId} (ลิงก์ไปยังระบบ ERP)
            </span>
          </div>
        );
      }

      lastIndex = match.index + match.fullMatch.length;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      const textEnd = content.substring(lastIndex);
      if (textEnd.trim()) {
        parts.push(
          <span key="text-end">
            {renderTextWithHighlight(textEnd, 'end', normalizedQuery)}
          </span>
        );
      }
    }

    return (
      <div className="body-medium text-on-surface leading-relaxed">
        {parts}
      </div>
    );
  }

  // No matches found, return plain text with highlighting
  return (
    <div className="body-medium text-on-surface leading-relaxed whitespace-pre-wrap break-words">
      {renderTextWithHighlight(content, 'full', normalizedQuery)}
    </div>
  );
}

// Helper function to render text with search highlighting
function renderTextWithHighlight(text: string, key: string, normalizedQuery?: string) {
  if (!text) return null;
  if (!normalizedQuery) {
    return <span key={key}>{text}</span>;
  }

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'gi');

  return (
    <span key={key}>
      {text.split(regex).map((part, index) => {
        if (!part) return null;
        const partKey = `${key}-${index}`;
        if (part.toLowerCase() === normalizedQuery) {
          return (
            <mark
              key={partKey}
              className="bg-yellow-400/90 dark:bg-yellow-500/80 text-gray-900 dark:text-gray-900 font-medium rounded px-1 py-0.5 shadow-sm"
            >
              {part}
            </mark>
          );
        }
        return <span key={partKey}>{part}</span>;
      })}
    </span>
  );
}

export default MessageContent;