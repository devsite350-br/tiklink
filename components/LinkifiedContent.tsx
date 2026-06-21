import React from 'react';

// Regex to find URLs (http, www, TLDs) and emails. Using non-capturing groups to prevent duplication in split().
const linkRegex = /(\b(?:https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.(?:com|org|net|il|io|co|dev|app|page)\b(?:[/\w?=&-]*))|\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b)/g;

const LinkifiedContent: React.FC<{ content: string | null | undefined }> = ({ content }) => {
    if (!content) return null;

    // We filter out empty strings and undefined values which can result from the split.
    const parts = content.split(linkRegex).filter(part => part);

    return (
        <>
            {parts.map((part, index) => {
                if (part.match(linkRegex)) {
                    let href = part;
                    if (part.includes('@')) {
                        href = `mailto:${part}`;
                    } else if (!part.startsWith('http')) {
                        href = `https://${part}`;
                    }
                    return (
                        <a
                            key={index}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }
                // Using React.Fragment to avoid adding extra nodes for plain text parts.
                // The whitespace-pre-wrap on the parent p tag will handle line breaks.
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </>
    );
};

export default LinkifiedContent;
