import React from 'react';
import { 
  QueueStatusUpdateCard, 
  QueueAcceptedCard, 
  QueuePreviewCard,
  FileCheckCard, 
  ReqTypeChangeCard,
  Hyperlink,
  ProofMetaCard
} from './MetaCards';

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

// Helper function to format customer name from regex extraction
function formatCustomerName(name: string | undefined): string | null {
  if (!name || name.trim() === '' || name.trim() === '#N/A') {
    return null;
  }
  return name.trim();
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
    const [, queueId, oldStatus, newStatus, rawCustomerName, queueName] = statusMatch;
    const customerName = formatCustomerName(rawCustomerName);
    return (
      <QueueStatusUpdateCard
        queueId={parseInt(queueId, 10)}
        queueName={queueName}
        oldStatus={oldStatus}
        newStatus={newStatus}
        timestamp={message.timestamp}
        userName={message.userName}
        customerName={customerName}
      />
    );
  }

  // Detect proof data format: 📋 New Proof Data Created: {jobName}
  // The proof metadata is passed as an attachment (JSON string)
  const proofRegex = /^📋 New Proof Data Created: (.+)$/;
  const proofMatch = content.match(proofRegex);

  if (proofMatch) {
    // This is just the text indicator - the actual card will be rendered from attachments
    // Return null to hide the text since the card will show all the info
    return null;
  }

  // Detect queue request type change format: [QUEUE_REQTYPE_CHANGE|queueId|oldType|newType|customerName]QueueName
  // Also support old format without customerName: [QUEUE_REQTYPE_CHANGE|queueId|oldType|newType]QueueName
  const reqTypeChangeRegex = /^\[QUEUE_REQTYPE_CHANGE\|(\d+)\|([a-z-]+)\|([a-z-]+)(?:\|([^\]]*))?\](.+)$/;
  const reqTypeMatch = content.match(reqTypeChangeRegex);

  if (reqTypeMatch && message) {
    const [, queueId, oldType, newType, rawCustomerName, jobName] = reqTypeMatch;
    const customerName = formatCustomerName(rawCustomerName);
    return (
      <ReqTypeChangeCard
        queueId={queueId}
        jobName={jobName}
        oldType={oldType}
        newType={newType}
        customerName={customerName}
      />
    );
  }

  // Detect queue accepted format: [QUEUE_ACCEPTED|queueId|userName|profilePicture|customerName]JobName
  // Also support old format without customerName: [QUEUE_ACCEPTED|queueId|userName|profilePicture]JobName
  const queueAcceptedRegex = /^\[QUEUE_ACCEPTED\|(\d+)\|([^|]+)\|([^|]*)(?:\|([^\]]*))?\](.+)$/;
  const queueAcceptedMatch = content.match(queueAcceptedRegex);

  if (queueAcceptedMatch) {
    const [, queueId, userName, userProfilePicture, rawCustomerName, jobName] = queueAcceptedMatch;
    const customerName = formatCustomerName(rawCustomerName);
    return (
      <QueueAcceptedCard
        queueId={queueId}
        jobName={jobName}
        userName={userName}
        userProfilePicture={userProfilePicture || null}
        customerName={customerName}
      />
    );
  }

  // Detect queue preview format: [QUEUE_PREVIEW|queueId]
  const queuePreviewRegex = /^\[QUEUE_PREVIEW\|(\d+)\]$/;
  const queuePreviewMatch = content.match(queuePreviewRegex);

  if (queuePreviewMatch) {
    const [, queueId] = queuePreviewMatch;
    return (
      <QueuePreviewCard queueId={queueId} />
    );
  }

  // Detect status post format: [STATUS_POST|status|message]
  const statusPostRegex = /^\[STATUS_POST\|([A-Z_]+)\|(.+)\]$/;
  const statusPostMatch = content.match(statusPostRegex);

  if (statusPostMatch) {
    const [, status, statusMessage] = statusPostMatch;
    return (
      <div className="my-3 max-w-md">
        <div className="p-4 bg-surface-container border border-outline-variant rounded-2xl shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                  status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  status === 'ERROR' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {status.replace('_', ' ')}
                </span>
              </div>
              <p className="body-medium text-on-surface">{statusMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Detect action format: [ACTION|type|data]
  const actionRegex = /^\[ACTION\|([A-Z_]+)\|(.+)\]$/;
  const actionMatch = content.match(actionRegex);

  if (actionMatch) {
    const [, actionType, actionData] = actionMatch;
    return (
      <div className="my-3 max-w-md">
        <div className="p-4 bg-surface-container border border-outline-variant rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-secondary/10 flex-shrink-0">
              <svg className="h-5 w-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="title-medium font-medium text-on-surface mb-1">
                {actionType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </h4>
              <p className="body-small text-on-surface-variant">{actionData}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Detect queue links with request types: [คำขอ #123: Job Name (requestType)](/works/queue)
  // Handle cases where job name might contain parentheses
  const queueLinkRegex = /^\[คำขอ #(\d+): (.+) \(([^)]+)\)\]\(\/works\/queue\)$/;
  const queueLinkMatch = content.match(queueLinkRegex);

  if (queueLinkMatch) {
    const [, queueId, jobName, requestType] = queueLinkMatch;
    
    // Special handling for checkfile requests
    if (requestType === 'checkfile') {
      return (
        <FileCheckCard
          queueId={queueId}
          jobName={jobName}
        />
      );
    }
    
    // For other request types, show a general queue card with the extracted info
    return (
      <div className="my-3 max-w-md">
        <div className="p-4 bg-surface-container border border-outline-variant rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="title-medium font-medium text-on-surface truncate">{jobName}</h4>
              <p className="body-small text-on-surface-variant mt-1">คำขอ #{queueId}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {requestType}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Detect queue links without specific format matching (fallback): [คำขอ #123: anything](/works/queue)
  const generalQueueLinkRegex = /\[คำขอ #(\d+):.+?\]\(\/works\/queue\)/g;
  const queueMatches: Array<{ index: number; queueId: string; fullMatch: string }> = [];
  let match;
  
  while ((match = generalQueueLinkRegex.exec(content)) !== null) {
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

  // Detect URLs in the content
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const urlMatches: Array<{ index: number; url: string; fullMatch: string }> = [];
  let urlMatchResult: RegExpExecArray | null;
  
  while ((urlMatchResult = urlRegex.exec(content)) !== null) {
    // Check if this URL is not already part of a markdown link or other pattern
    const beforeUrl = content.substring(0, urlMatchResult.index);
    const afterUrl = content.substring(urlMatchResult.index + urlMatchResult[0].length);
    
    // Skip if URL is part of markdown link syntax [text](url)
    if (beforeUrl.endsWith('](') || beforeUrl.endsWith('(') && afterUrl.startsWith(')')) {
      continue;
    }
    
    // Skip if URL overlaps with existing matches
    const overlaps = allMatches.some(match => 
      urlMatchResult!.index >= match.index && 
      urlMatchResult!.index < match.index + match.fullMatch.length
    );
    
    if (!overlaps) {
      urlMatches.push({
        index: urlMatchResult.index,
        url: urlMatchResult[0],
        fullMatch: urlMatchResult[0],
      });
    }
  }

  // Add URL matches to all matches and re-sort
  const allMatchesWithUrls = [
    ...allMatches,
    ...urlMatches.map(m => ({ ...m, type: 'url' as const })),
  ].sort((a, b) => a.index - b.index);

  // If we have matches, render with preview cards
  if (allMatchesWithUrls.length > 0) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    allMatchesWithUrls.forEach((match, i) => {
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

      // Add preview card or component based on match type
      if (match.type === 'queue') {
        parts.push(
          <div key={`queue-${i}`} className="my-2">
            <div className="p-4 bg-surface-container border border-outline-variant rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="title-medium font-medium text-on-surface">คำขอ #{(match as any).queueId}</h4>
                  <p className="body-small text-on-surface-variant mt-1">คลิกเพื่อดูรายละเอียด</p>
                </div>
              </div>
            </div>
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
      } else if (match.type === 'url') {
        parts.push(
          <div key={`url-${i}`}>
            <Hyperlink url={(match as any).url} />
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

  // No matches found, check for standalone URLs in plain text
  const standaloneUrlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const standaloneUrlMatches = Array.from(content.matchAll(standaloneUrlRegex));
  
  if (standaloneUrlMatches.length > 0) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    standaloneUrlMatches.forEach((match, i) => {
      const url = match[0];
      const index = match.index!;

      // Add text before this URL
      if (index > lastIndex) {
        const textBefore = content.substring(lastIndex, index);
        if (textBefore.trim()) {
          parts.push(
            <span key={`text-${i}`}>
              {renderTextWithHighlight(textBefore, `before-${i}`, normalizedQuery)}
            </span>
          );
        }
      }

      // Add URL preview
      parts.push(
        <div key={`url-${i}`}>
          <Hyperlink url={url} />
        </div>
      );

      lastIndex = index + url.length;
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

  // No URLs or other matches found, return plain text with highlighting
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