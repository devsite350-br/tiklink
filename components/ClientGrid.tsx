import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Client, Task, CustomFieldType, StatusDefinition } from '../types';
import { useAppContext } from '../context/AppContext';
import LinkifiedContent from './LinkifiedContent';
import { UserAvatar } from './UserAvatar';
import { Phone, Mail, ExternalLink, Calendar, Plus, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

const formatUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `https://${url}`;
};

const getDisplayUrl = (url: string): string => {
    if (!url) return '';
    // Remove protocol and www
    let display = url.replace(/^(https?:\/\/)?(www\.)?/, '');
    // Remove trailing slash
    display = display.replace(/\/$/, '');
    return display;
};

const formatWhatsAppNumber = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) {
        return '972' + cleanNumber.substring(1);
    }
    return cleanNumber;
};

// Helper to determine if a color is light or dark
const isColorLight = (hexColor: string) => {
    const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16); // hexToR
    const g = parseInt(color.substring(2, 4), 16); // hexToG
    const b = parseInt(color.substring(4, 6), 16); // hexToB
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
};

const ClientCard: React.FC<{ client: Client, onCardClick: (client: Client) => void }> = ({ client, onCardClick }) => {
    const { updateClient, customFields, labelMap, teamMembers, leadSources, visibilitySettings, meetings } = useAppContext();
    const [newTaskText, setNewTaskText] = useState('');
    const assignedMember = client.assignedTo ? teamMembers.find(m => m.id === client.assignedTo) : null;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.dataTransfer.setData('clientId', client.id);
        e.dataTransfer.setData('clientStatus', client.status);
    };

    const handleTaskToggle = (taskId: string) => {
        const updatedTasks = client.tasks.map(task =>
            task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
        );
        updateClient({ ...client, tasks: updatedTasks });
    };

    const handleQuickAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (newTaskText.trim()) {
            const newTask: Task = {
                id: `task_${Date.now()}`,
                text: newTaskText.trim(),
                isCompleted: false,
            };
            updateClient({ ...client, tasks: [...client.tasks, newTask] });
            setNewTaskText('');
        }
    };

    const handleLinkClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const gridFields = customFields.filter(f => f.showInGrid ?? true);
    const notesFieldDef = customFields.find(f => f.id === '__notes');
    const showNotesInGrid = notesFieldDef?.showInGrid === true;
    const openTasks = client.tasks.filter(task => !task.isCompleted);
    const clientLabels = visibilitySettings.labels.showInGrid ? (client.labelIds || []).map(id => labelMap.get(id)).filter(Boolean) : [];
    const showTasks = visibilitySettings.tasks.showInGrid;
    const showUsers = visibilitySettings.users.showInGrid;
    const showAiSummary = visibilitySettings.aiSummary.showInGrid;
    const showLeadSource = visibilitySettings.leadSources.showInGrid;
    const showMeetings = visibilitySettings.meetings?.enabled !== false && visibilitySettings.meetings?.showInGrid;
    const assignedMemberVisible = showUsers && client.assignedTo ? teamMembers.find(m => m.id === client.assignedTo) : null;
    const leadSourceName = showLeadSource ? (
        client.sourceId === '__import__' ? 'ייבוא' :
        client.sourceId ? leadSources.find(s => s.id === client.sourceId)?.name || null :
        'ידנית'
    ) : null;

    const clientMeetings = showMeetings ? meetings.filter(m => m.clientId === client.id).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()) : [];
    const latestMeeting = clientMeetings.length > 0 ? clientMeetings[0] : null;

    const phoneField = customFields.find(f => f.type === CustomFieldType.PHONE);
    const emailField = customFields.find(f => f.type === CustomFieldType.EMAIL);
    const urlField = customFields.find(f => f.type === CustomFieldType.URL);
    const phoneValue = phoneField ? client.customFields[phoneField.id] : null;
    const emailValue = emailField ? client.customFields[emailField.id] : null;
    const urlValue = urlField ? client.customFields[urlField.id] : null;

    return (
        <div
            draggable={true}
            onDragStart={handleDragStart}
            onClick={() => onCardClick(client)}
            className="group bg-white dark:bg-base-900 p-2.5 rounded-xl shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 border border-gray-100 dark:border-white/5 relative overflow-hidden cursor-grab active:cursor-grabbing flex flex-col"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="relative z-10 overflow-hidden flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">{client.name}</h4>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[50%] min-h-[18px]">
                        {clientLabels.map(label => label && (
                            <span key={label.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm"
                                style={{ backgroundColor: label.color, color: isColorLight(label.color) ? '#000' : '#FFF' }}>
                                {label.name}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex gap-1.5 mb-2 min-h-[20px]">
                    {phoneValue && (
                        <>
                            <a href={`https://wa.me/${formatWhatsAppNumber(phoneValue)}`} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} title="וואטסאפ" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                            </a>
                            <a href={`tel:${phoneValue}`} onClick={handleLinkClick} title="חייג" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                <Phone className="h-2.5 w-2.5" />
                            </a>
                        </>
                    )}
                    {emailValue && (
                        <a href={`mailto:${emailValue}`} onClick={handleLinkClick} title="שלח אימייל" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                            <Mail className="h-2.5 w-2.5" />
                        </a>
                    )}
                    {urlValue && (
                        <a href={formatUrl(urlValue)} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} title="פתח קישור" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                            <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                    )}
                </div>

                {leadSourceName && (
                    <div className="mb-1.5">
                        <div className="text-[10px] font-semibold text-primary bg-primary/5 dark:bg-primary/20 px-2 py-0.5 rounded-full inline-block">
                            מקור: {leadSourceName}
                        </div>
                    </div>
                )}

                <div className={`flex-1 relative${assignedMemberVisible ? ' pl-[23px]' : ''}`}>
                    {assignedMemberVisible && (
                        <div className="absolute bottom-0 left-0">
                            <UserAvatar
                                name={assignedMemberVisible.displayName || assignedMemberVisible.email || ''}
                                photoUrl={assignedMemberVisible.photoUrl}
                                size="xs"
                            />
                        </div>
                    )}
                    {gridFields.filter(f => f.id !== '__createdAt' && f.id !== '__notes').map(field => {
                        const value = client.customFields[field.id];
                        return (
                            <div key={field.id} className="text-[0.85rem] text-gray-500 dark:text-gray-400 mb-0.5 flex items-center min-w-0 overflow-hidden">
                                <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap ml-1">{field.name}:</span>
                                {!value ? <span className="text-gray-300">-</span> :
                                    field.type === CustomFieldType.URL ? (
                                        <a href={formatUrl(value)} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} dir="ltr" className="text-primary hover:underline font-normal block truncate min-w-0 text-right" title={value}>{getDisplayUrl(value)}</a>
                                    ) : field.type === CustomFieldType.EMAIL ? (
                                        <a href={`mailto:${value}`} onClick={handleLinkClick} className="text-gray-900 dark:text-gray-100 truncate block">{value}</a>
                                    ) : field.type === CustomFieldType.PHONE ? (
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <a href={`tel:${value}`} onClick={handleLinkClick} dir="ltr" className="text-gray-900 dark:text-gray-100 truncate text-left">{value}</a>
                                        </div>
                                    ) : (
                                        <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{value}</span>
                                    )
                                }
                            </div>
                        );
                    })}

                    {/* System field: createdAt */}
                    {gridFields.some(f => f.id === '__createdAt') && client.createdAt && (
                        <div className="text-[0.85rem] text-gray-500 dark:text-gray-400 mb-0.5 flex items-center min-w-0 overflow-hidden">
                            <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap ml-1">תאריך יצירה:</span>
                            <span className="text-gray-700 dark:text-gray-300">{new Date(client.createdAt).toLocaleDateString('he-IL')}</span>
                        </div>
                    )}
                    {/* System field: notes */}
                    {showNotesInGrid && (
                        <div className="text-[0.85rem] text-gray-500 dark:text-gray-400 mb-0.5 flex items-center min-w-0 overflow-hidden">
                            <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap ml-1">פרטים נוספים:</span>
                            {client.notes
                                ? <span className="text-gray-700 dark:text-gray-300 truncate" title={client.notes}>{client.notes}</span>
                                : <span className="text-gray-300 dark:text-gray-600">-</span>
                            }
                        </div>
                    )}
                </div>

                {showAiSummary && client.aiSummary && (
                    <div className="mt-1.5 p-1.5 bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-500/20 rounded-lg text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 italic">
                        <Sparkles className="w-4 h-4 inline-block mr-1" />{client.aiSummary}
                    </div>
                )}

                {showMeetings && latestMeeting && (
                    <div className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-300 px-1.5 py-1 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-base-950 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="truncate">{latestMeeting.title}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>{new Date(latestMeeting.startTime).toLocaleDateString('he-IL')}</span>
                            <span dir="ltr">{new Date(latestMeeting.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                )}

                {showTasks && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5" onClick={e => e.stopPropagation()}>
                        <h5 className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">משימות ({openTasks.length})</h5>
                        {openTasks.length > 0 ? (
                            <ul className="space-y-1 mb-2">
                                {openTasks.slice(-1).map(task => (
                                    <li key={task.id} className="flex items-center gap-2 text-[0.85rem] group/task min-w-0">
                                        <input type="checkbox" checked={task.isCompleted} onChange={() => handleTaskToggle(task.id)} className="flex-shrink-0 form-checkbox h-3.5 w-3.5 rounded-full text-primary focus:ring-primary/50 border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/5 transition-all cursor-pointer" />
                                        <span className={`text-gray-600 dark:text-gray-300 group-hover/task:text-primary transition-colors truncate min-w-0 ${task.isCompleted ? 'line-through text-gray-400' : ''}`} title={task.text}>
                                            {task.text}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : <div className="mb-2 flex items-center text-[0.85rem] leading-normal"><span className="text-gray-400 italic">אין משימות פתוחות</span></div>}

                        <form onSubmit={handleQuickAddTask} className="flex gap-2 relative group/input">
                            <input
                                type="text"
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                placeholder="הוסף משימה..."
                                className="flex-grow pl-3 pr-3 py-1 text-[0.85rem] bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder-gray-400"
                            />
                            <button type="submit" className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold text-lg transition-all absolute left-1 top-0.5 opacity-0 group-hover/input:opacity-100" aria-label="הוסף משימה">
                                <Plus className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusColumn: React.FC<{
    status: StatusDefinition;
    clients: Client[];
    onCardClick: (client: Client) => void;
    columnStyle: React.CSSProperties;
}> = ({ status, clients, onCardClick, columnStyle }) => {
    const { updateClientStatus } = useAppContext();
    const [isOver, setIsOver] = useState(false);
    const textColor = isColorLight(status.color) ? 'text-gray-800' : 'text-white';

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = () => setIsOver(false);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const clientId = e.dataTransfer.getData('clientId');
        const clientCurrentStatus = e.dataTransfer.getData('clientStatus');
        if (clientId && status.name !== clientCurrentStatus) {
            updateClientStatus(clientId, status.name);
        }
        setIsOver(false);
    };

    const dotBg = isColorLight(status.color) ? 'bg-gray-800/70' : 'bg-white/90';

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col snap-center py-2 px-[5px] rounded-xl transition-all duration-300 overflow-hidden ${isOver ? 'ring-2 ring-primary/30' : ''}`}
            style={columnStyle}
        >
            <div className="flex items-center gap-2 mb-3 px-0.5">
                <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${textColor}`}
                    style={{ backgroundColor: status.color }}
                >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotBg}`} />
                    <span className="tracking-tight">{status.name}</span>
                </div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{clients.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pb-3 hide-scrollbar px-0">
                {clients.map(client => (
                    <ClientCard key={client.id} client={client} onCardClick={onCardClick} />
                ))}
            </div>
        </div>
    );
};

export const ClientGrid: React.FC<{
    clientsByStatus: { [key: string]: Client[] };
    onCardClick: (client: Client) => void;
}> = ({ clientsByStatus, onCardClick }) => {
    const { statuses } = useAppContext();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile (matches Tailwind `sm` breakpoint at 640px)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const totalStatuses = statuses.length;
    const hasDesktopOverflow = !isMobile && totalStatuses > 5;
    // On mobile every column is full-width; on desktop use elastic or fixed 19%
    const columnStyle: React.CSSProperties = isMobile
        ? { flex: '0 0 100%' }
        : hasDesktopOverflow
            ? { flex: '0 0 19%', minWidth: 0 }
            : { flex: '1 0 0%', minWidth: 0 };

    // Show arrows on mobile (always overflow) or on desktop with >5 statuses
    const showArrows = isMobile || hasDesktopOverflow;

    const updateScrollButtons = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const isRtl = getComputedStyle(el).direction === 'rtl';
        if (isRtl) {
            setCanScrollRight(Math.abs(el.scrollLeft) > 5);
            setCanScrollLeft(el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) > 5);
        } else {
            setCanScrollLeft(el.scrollLeft > 5);
            setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 5);
        }
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !showArrows) {
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }
        updateScrollButtons();
        el.addEventListener('scroll', updateScrollButtons, { passive: true });
        const observer = new ResizeObserver(updateScrollButtons);
        observer.observe(el);
        return () => {
            el.removeEventListener('scroll', updateScrollButtons);
            observer.disconnect();
        };
    }, [showArrows, updateScrollButtons, statuses.length]);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        // On mobile scroll by full column width, on desktop by 1/5th of container
        const scrollAmount = isMobile ? el.clientWidth : el.clientWidth / 5;
        const amount = direction === 'left' ? -scrollAmount : scrollAmount;
        el.scrollBy({ left: amount, behavior: 'smooth' });
    };

    return (
        <div className="h-full relative">
            {/* Arrow buttons - tiny at edge on mobile, normal aligned with headers on desktop */}
            {showArrows && canScrollRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute -right-1 sm:right-0 top-2 sm:top-[22px] -translate-y-1/2 z-30 flex items-center justify-center w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-white/80 sm:bg-white/90 dark:bg-base-800/90 shadow sm:shadow-md border border-gray-200/40 sm:border-gray-200/60 dark:border-white/10 text-gray-400 sm:text-gray-500 hover:text-primary hover:bg-white hover:shadow-lg transition-all cursor-pointer"
                    aria-label="גלול ימינה"
                >
                    <ChevronRight className="w-2 h-2 sm:w-3.5 sm:h-3.5" />
                </button>
            )}
            {showArrows && canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute -left-1 sm:left-0 top-2 sm:top-[22px] -translate-y-1/2 z-30 flex items-center justify-center w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-white/80 sm:bg-white/90 dark:bg-base-800/90 shadow sm:shadow-md border border-gray-200/40 sm:border-gray-200/60 dark:border-white/10 text-gray-400 sm:text-gray-500 hover:text-primary hover:bg-white hover:shadow-lg transition-all cursor-pointer"
                    aria-label="גלול שמאלה"
                >
                    <ChevronLeft className="w-2 h-2 sm:w-3.5 sm:h-3.5" />
                </button>
            )}
            <div
                ref={scrollRef}
                className={`h-full flex flex-row gap-0 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory ${!isMobile && hasDesktopOverflow ? '!snap-none' : ''}`}
            >
                {statuses.map(status => (
                    <StatusColumn
                        key={status.id}
                        status={status}
                        clients={clientsByStatus[status.name] || []}
                        onCardClick={onCardClick}
                        columnStyle={columnStyle}
                    />
                ))}
            </div>
        </div>
    );
};

