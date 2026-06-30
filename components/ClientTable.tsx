
import React, { useState, useCallback } from 'react';
import { Client, CustomFieldType, CustomFieldDefinition, isSystemFieldId } from '../types';
import { useAppContext } from '../context/AppContext';
import LinkifiedContent from './LinkifiedContent';
import { UserAvatar } from './UserAvatar';
import { BulkEditModal } from './BulkEditModal';
import { useConfirm } from './ConfirmDialog';
import { Pencil, Trash2, X, Check, Minus, Phone, Mail, ExternalLink, Users, Search, Sparkles } from 'lucide-react';

interface ClientTableProps {
    clients: Client[];
    onRowClick: (client: Client) => void;
}

const isColorLight = (hexColor: string) => {
    const color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186);
};

const hexToRgba = (hexColor: string, alpha: number) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.length === 3 ? hex.substring(0, 1).repeat(2) : hex.substring(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex.substring(1, 2).repeat(2) : hex.substring(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex.substring(2, 3).repeat(2) : hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return hexColor;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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

const RenderFieldValue: React.FC<{ field: CustomFieldDefinition, value: string, onLinkClick: (e: React.MouseEvent) => void }> = ({ field, value, onLinkClick }) => {
    if (!value) return <span>-</span>;

    switch (field.type) {
        case CustomFieldType.URL:
            return (
                <div className="flex justify-center">
                    <a
                        href={formatUrl(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onLinkClick}
                        dir="ltr"
                        className="text-primary hover:underline font-normal block truncate max-w-[150px] text-right"
                        title={value}
                    >
                        {getDisplayUrl(value)}
                    </a>
                </div>
            );
        case CustomFieldType.EMAIL:
            return <a href={`mailto:${value}`} onClick={onLinkClick} className="text-gray-900 dark:text-gray-100 block truncate max-w-[150px]">{value}</a>;
        case CustomFieldType.PHONE:
            return <a href={`tel:${value}`} onClick={onLinkClick} dir="ltr" className="text-gray-900 dark:text-gray-100 block truncate max-w-[150px]">{value}</a>;
        default:
            return <span className="whitespace-pre-wrap">{value}</span>;
    }
};

export const ClientTable: React.FC<ClientTableProps> = ({ clients, onRowClick }) => {
    const { deleteClient, customFields, statusMap, labelMap, teamMembers, leadSources, visibilitySettings, meetings, entityLabels } = useAppContext();
    const confirm = useConfirm();

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

    const listFields = customFields.filter(f => f.showInList ?? true);
    const showStatuses = visibilitySettings.statuses.showInList;
    const showLabels = visibilitySettings.labels.showInList;
    const showUsers = visibilitySettings.users.showInList;
    const showTasks = visibilitySettings.tasks.showInList;
    const showAiSummary = visibilitySettings.aiSummary.showInList;
    const showLeadSources = visibilitySettings.leadSources.showInList;
    const showMeetings = visibilitySettings.meetings?.enabled !== false && visibilitySettings.meetings?.showInList;
    const showCreatedAt = listFields.some(f => f.id === '__createdAt') || customFields.find(f => f.id === '__createdAt')?.showInList;
    const showNotesInList = customFields.find(f => f.id === '__notes')?.showInList === true;

    const handleLinkClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const handleDeleteClient = async (e: React.MouseEvent, clientId: string) => {
        e.stopPropagation();
        if (await confirm({ message: `האם אתה בטוח שברצונך למחוק את ${entityLabels.theSingular}?` })) {
            deleteClient(clientId);
        }
    };

    // Selection handlers
    const allSelected = clients.length > 0 && clients.every(c => selectedIds.has(c.id));
    const someSelected = clients.some(c => selectedIds.has(c.id));

    const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(clients.map(c => c.id)));
        }
    }, [allSelected, clients]);

    const handleSelectOne = useCallback((e: React.MouseEvent | React.ChangeEvent, clientId: string) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(clientId)) {
                next.delete(clientId);
            } else {
                next.add(clientId);
            }
            return next;
        });
    }, []);

    const selectedClients = clients.filter(c => selectedIds.has(c.id));

    const handleBulkDelete = async () => {
        if (await confirm({ message: `האם אתה בטוח שברצונך למחוק ${selectedClients.length} ${entityLabels.plural}?` })) {
            selectedClients.forEach(c => deleteClient(c.id));
            setSelectedIds(new Set());
        }
    };

    const handleBulkEditComplete = () => {
        setSelectedIds(new Set());
    };

    const hasSelection = selectedIds.size > 0;

    return (
        <>
            <div className="bg-white/80 dark:bg-base-900/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-gray-100 dark:border-white/5 mx-2 h-full flex flex-col">
                {/* Bulk Action Bar */}
                {hasSelection && (
                    <div className="bg-primary/10 dark:bg-primary/20 border-b border-primary/20 px-4 py-3 flex items-center gap-4 flex-shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2 text-sm font-bold text-primary">
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold">
                                {selectedIds.size}
                            </div>
                            <span>{entityLabels.plural} נבחרו</span>
                        </div>
                        <div className="flex-1"></div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsBulkEditOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-95"
                            >
                                <Pencil className="w-4 h-4" />
                                <span>עריכה מרובה</span>
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/25 hover:scale-[1.02] active:scale-95"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>מחק</span>
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="flex items-center gap-1 px-3 py-2 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 rounded-xl text-sm transition-all"
                            >
                                <X className="w-4 h-4" />
                                <span>בטל בחירה</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Desktop Table View */}
                <div className="overflow-x-auto hidden md:block flex-1 h-full">
                    <table className="w-full min-w-max border-collapse">
                        <thead className="bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-3 py-3 w-10">
                                    <div className="flex items-center justify-center">
                                        <label className="relative flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                                onChange={handleSelectAll}
                                                className="peer sr-only"
                                            />
                                            <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                                                {allSelected && (
                                                    <Check className="w-3.5 h-3.5 text-white" />
                                                )}
                                                {someSelected && !allSelected && (
                                                    <Minus className="w-3.5 h-3.5 text-primary" />
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                </th>
                                <th className="px-4 py-3 font-bold text-right">{entityLabels.nameOf}</th>
                                {showStatuses && <th className="px-4 py-3 font-bold text-center">סטטוס</th>}
                                {showLabels && <th className="px-4 py-3 font-bold text-center">תגיות</th>}
                                {listFields.filter(f => !isSystemFieldId(f.id)).map(field => (
                                    <th key={field.id} className="px-4 py-3 font-bold text-center">{field.name}</th>
                                ))}
                                {showCreatedAt && <th className="px-4 py-3 font-bold text-center">תאריך יצירה</th>}
                                {showNotesInList && <th className="px-4 py-3 font-bold text-center">פרטים נוספים</th>}
                                {showLeadSources && <th className="px-4 py-3 font-bold text-center">מקור הגעה</th>}
                                {showAiSummary && <th className="px-4 py-3 font-bold text-center">סיכום AI</th>}
                                {showUsers && <th className="px-4 py-3 font-bold text-center">משתמש</th>}
                                {showMeetings && <th className="px-4 py-3 font-bold text-center">פגישה</th>}
                                {showTasks && <th className="px-4 py-3 font-bold text-center">משימות פתוחות</th>}
                                <th className="px-4 py-3 font-bold w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((client, index) => {
                                const openTasks = client.tasks.filter(t => !t.isCompleted);
                                const statusColor = statusMap.get(client.status)?.color || '#cccccc';
                                const clientLabels = showLabels ? (client.labelIds || []).map(id => labelMap.get(id)).filter(Boolean) : [];

                                const phoneField = customFields.find(f => f.type === CustomFieldType.PHONE);
                                const emailField = customFields.find(f => f.type === CustomFieldType.EMAIL);
                                const urlField = customFields.find(f => f.type === CustomFieldType.URL);
                                const phoneValue = phoneField ? client.customFields[phoneField.id] : null;
                                const emailValue = emailField ? client.customFields[emailField.id] : null;
                                const urlValue = urlField ? client.customFields[urlField.id] : null;

                                const prevClient = index > 0 ? clients[index - 1] : null;
                                const isNewStatusGroup = !prevClient || prevClient.status !== client.status;

                                const isSelected = selectedIds.has(client.id);

                                return (
                                    <React.Fragment key={client.id}>
                                        {isNewStatusGroup && showStatuses && (
                                            <tr>
                                                <td colSpan={100}>
                                                    <div className="flex items-center gap-3 px-4 py-2" style={{ backgroundColor: hexToRgba(statusColor, 0.07) }}>
                                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }}></span>
                                                        <span className="text-xs font-bold tracking-wide" style={{ color: statusColor }}>{client.status}</span>
                                                        <div className="flex-1 h-px" style={{ backgroundColor: hexToRgba(statusColor, 0.15) }}></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        <tr
                                            onClick={() => onRowClick(client)}
                                            className={`hover:bg-primary/5 dark:hover:bg-white/5 cursor-pointer transition-colors duration-200 group border-b border-gray-100 dark:border-white/5 ${isSelected ? 'bg-primary/[0.07] dark:bg-primary/10' : ''}`}
                                        >
                                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center">
                                                    <label className="relative flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => handleSelectOne(e, client.id)}
                                                            className="peer sr-only"
                                                        />
                                                        <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600 group-hover:border-primary/50'}`}>
                                                            {isSelected && (
                                                                <Check className="w-3.5 h-3.5 text-white" />
                                                            )}
                                                        </div>
                                                    </label>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 text-right text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="truncate max-w-[150px]">{client.name}</div>
                                                    <div className="flex gap-1 transition-opacity shrink-0">
                                                        {phoneValue && (
                                                            <>
                                                                <a href={`https://wa.me/${formatWhatsAppNumber(phoneValue)}`} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} title="וואטסאפ" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                                    </svg>
                                                                </a>
                                                                <a href={`tel:${phoneValue}`} onClick={handleLinkClick} title="חייג" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                                                    <Phone className="h-3 w-3" />
                                                                </a>
                                                            </>
                                                        )}
                                                        {emailValue && (
                                                            <a href={`mailto:${emailValue}`} onClick={handleLinkClick} title="שלח אימייל" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                                                <Mail className="h-3 w-3" />
                                                            </a>
                                                        )}
                                                        {urlValue && (
                                                            <a href={formatUrl(urlValue)} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} title="פתח קישור" className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            {showStatuses && (
                                                <td className="px-4 py-3 text-center text-sm">
                                                    <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                                        style={{ backgroundColor: hexToRgba(statusColor, 0.15) }}>
                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }}></span>
                                                        {client.status}
                                                    </span>
                                                </td>
                                            )}
                                            {showLabels && (
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                        {clientLabels.map(label => label && (
                                                            <span key={label.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm"
                                                                style={{ backgroundColor: label.color, color: isColorLight(label.color) ? '#000' : '#FFF' }}>
                                                                {label.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            )}
                                            {listFields.filter(f => !isSystemFieldId(f.id)).map(field => (
                                                <td key={field.id} className="px-4 py-3 text-gray-600 dark:text-gray-300 text-center text-sm">
                                                    <RenderFieldValue field={field} value={client.customFields[field.id]} onLinkClick={handleLinkClick} />
                                                </td>
                                            ))}
                                            {showCreatedAt && (
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center text-sm">
                                                    {client.createdAt ? new Date(client.createdAt).toLocaleDateString('he-IL') : '-'}
                                                </td>
                                            )}
                                            {showNotesInList && (
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-center text-sm max-w-[200px]">
                                                    {client.notes ? (
                                                        <span className="block truncate" title={client.notes}>{client.notes}</span>
                                                    ) : '-'}
                                                </td>
                                            )}
                                            {showLeadSources && (
                                                <td className="px-4 py-3 text-center text-sm">
                                                    {(() => {
                                                        if (client.sourceId === '__import__') return <span className="text-primary font-medium">ייבוא</span>;
                                                        const source = client.sourceId ? leadSources.find(s => s.id === client.sourceId) : null;
                                                        return source ? <span className="text-primary font-medium">{source.name}</span> : <span className="text-primary font-medium">ידנית</span>;
                                                    })()}
                                                </td>
                                            )}
                                            {showAiSummary && (
                                                <td className="px-4 py-3 text-center text-sm">
                                                    {client.aiSummary ? <span className="text-teal-600 dark:text-teal-400 italic truncate max-w-[150px] inline-flex items-center gap-1" title={client.aiSummary}><Sparkles className="w-4 h-4" /> {client.aiSummary}</span> : '-'}
                                                </td>
                                            )}
                                            {showUsers && (
                                                <td className="px-4 py-3 text-center">
                                                    {(() => {
                                                        const member = client.assignedTo ? teamMembers.find(m => m.id === client.assignedTo) : null;
                                                        return member ? (
                                                            <div className="flex justify-center">
                                                                <UserAvatar
                                                                    name={member.displayName || member.email || ''}
                                                                    photoUrl={member.photoUrl}
                                                                    size="xs"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-gray-600">-</span>
                                                        );
                                                    })()}
                                                </td>
                                            )}
                                            {showMeetings && (
                                                <td className="px-4 py-3 text-center text-sm">
                                                    {(() => {
                                                        const clientMeetings = meetings.filter(m => m.clientId === client.id).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
                                                        const latestMeeting = clientMeetings.length > 0 ? clientMeetings[0] : null;
                                                        return latestMeeting ? (
                                                            <div className="flex flex-col items-center gap-0.5 text-xs text-gray-600 dark:text-gray-300">
                                                                <span className="font-medium truncate max-w-[120px]" title={latestMeeting.title}>{latestMeeting.title}</span>
                                                                <span className="text-gray-500">{new Date(latestMeeting.startTime).toLocaleDateString('he-IL')} <span dir="ltr">{new Date(latestMeeting.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span></span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-gray-600">-</span>
                                                        );
                                                    })()}
                                                </td>
                                            )}
                                            {showTasks && (
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center text-sm">
                                                    {openTasks.length > 0 ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
                                                                {openTasks.length}
                                                            </span>
                                                            <span className="text-sm truncate max-w-[200px] text-gray-600 dark:text-gray-300">
                                                                <LinkifiedContent content={openTasks[0].text} />
                                                                {openTasks.length > 1 && <span className="text-xs text-gray-400 mr-1">(+{openTasks.length - 1})</span>}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 dark:text-gray-600">-</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={(e) => handleDeleteClient(e, client.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title={entityLabels.deleteEntity}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                            {clients.length === 0 && (
                                <tr>
                                    <td colSpan={100} className="text-center p-12 text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                                            <span>{entityLabels.noEntities} התואמים לחיפוש.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-2 p-2 bg-gray-50 dark:bg-base-950/50 flex-1 overflow-y-auto">
                    {clients.length > 0 ? clients.map(client => {
                        const openTasks = client.tasks.filter(t => !t.isCompleted);
                        const statusColor = statusMap.get(client.status)?.color || '#cccccc';
                        const clientLabels = showLabels ? (client.labelIds || []).map(id => labelMap.get(id)).filter(Boolean) : [];

                        const phoneField = customFields.find(f => f.type === CustomFieldType.PHONE);
                        const emailField = customFields.find(f => f.type === CustomFieldType.EMAIL);
                        const urlField = customFields.find(f => f.type === CustomFieldType.URL);
                        const phoneValue = phoneField ? client.customFields[phoneField.id] : null;
                        const emailValue = emailField ? client.customFields[emailField.id] : null;
                        const urlValue = urlField ? client.customFields[urlField.id] : null;

                        const isSelected = selectedIds.has(client.id);

                        return (
                            <div key={client.id} onClick={() => onRowClick(client)} className={`bg-white dark:bg-base-900 p-3 rounded-2xl shadow-sm border active:scale-[0.98] transition-all group ${isSelected ? 'border-primary/50 bg-primary/5 dark:bg-primary/10' : 'border-gray-100 dark:border-white/5'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        {/* Mobile checkbox */}
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <label className="relative flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectOne(e, client.id)}
                                                    className="peer sr-only"
                                                />
                                                <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'}`}>
                                                    {isSelected && (
                                                        <Check className="w-3.5 h-3.5 text-white" />
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                        {(() => {
                                            if (!showUsers) return null;
                                            const member = client.assignedTo ? teamMembers.find(m => m.id === client.assignedTo) : null;
                                            return member ? (
                                                <UserAvatar
                                                    name={member.displayName || member.email || ''}
                                                    photoUrl={member.photoUrl}
                                                    size="xs"
                                                />
                                            ) : null;
                                        })()}
                                        <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{client.name}</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleDeleteClient(e, client.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                                            title={entityLabels.deleteEntity}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full"
                                            style={{ backgroundColor: hexToRgba(statusColor, 0.15) }}>
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }}></span>
                                            {client.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-2">
                                    {phoneValue && (
                                        <>
                                            <a href={`https://wa.me/${formatWhatsAppNumber(phoneValue)}`} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} title="וואטסאפ" className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                </svg>
                                            </a>
                                            <a href={`tel:${phoneValue}`} onClick={handleLinkClick} title="חייג" className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                                <Phone className="h-3 w-3" />
                                            </a>
                                        </>
                                    )}
                                    {emailValue && (
                                        <a href={`mailto:${emailValue}`} onClick={handleLinkClick} title="שלח אימייל" className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                            <Mail className="h-3 w-3" />
                                        </a>
                                    )}
                                    {urlValue && (
                                        <a href={formatUrl(urlValue)} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick} title="פתח קישור" className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm">
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                                {showLabels && clientLabels.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {clientLabels.map(label => label && (
                                            <span key={label.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: label.color, color: isColorLight(label.color) ? '#000' : '#FFF' }}>
                                                {label.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="space-y-1 text-sm">
                                    {listFields.filter(f => !isSystemFieldId(f.id)).map(field => (
                                        <div key={field.id} className="flex justify-between items-center py-0.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <span className="font-medium text-gray-500 dark:text-gray-400">{field.name}:</span>
                                            <span className="text-left text-gray-700 dark:text-gray-200">
                                                <RenderFieldValue field={field} value={client.customFields[field.id]} onLinkClick={handleLinkClick} />
                                            </span>
                                        </div>
                                    ))}
                                    {showCreatedAt && client.createdAt && (
                                        <div className="flex justify-between items-center py-0.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <span className="font-medium text-gray-500 dark:text-gray-400">תאריך יצירה:</span>
                                            <span className="text-left text-gray-700 dark:text-gray-200">{new Date(client.createdAt).toLocaleDateString('he-IL')}</span>
                                        </div>
                                    )}
                                    {showNotesInList && client.notes && (
                                        <div className="flex justify-between items-center py-0.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <span className="font-medium text-gray-500 dark:text-gray-400">פרטים נוספים:</span>
                                            <span className="text-left text-gray-700 dark:text-gray-200 truncate max-w-[180px]" title={client.notes}>{client.notes}</span>
                                        </div>
                                    )}
                                    {showLeadSources && (
                                        <div className="flex justify-between items-center py-0.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <span className="font-medium text-gray-500 dark:text-gray-400">מקור:</span>
                                            <span className="text-left text-primary font-medium">
                                                {client.sourceId === '__import__' ? 'ייבוא' : client.sourceId ? (leadSources.find(s => s.id === client.sourceId)?.name || 'ידנית') : 'ידנית'}
                                            </span>
                                        </div>
                                    )}
                                    {showAiSummary && client.aiSummary && (
                                        <div className="py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <span className="block font-medium text-gray-500 dark:text-gray-400 mb-1">סיכום AI:</span>
                                            <span className="text-xs text-teal-600 dark:text-teal-400 italic line-clamp-3">
                                                <Sparkles className="w-3.5 h-3.5 inline-block mr-1" />{client.aiSummary}
                                            </span>
                                        </div>
                                    )}
                                    {showMeetings && (() => {
                                        const clientMeetings = meetings.filter(m => m.clientId === client.id).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
                                        const latestMeeting = clientMeetings.length > 0 ? clientMeetings[0] : null;
                                        return latestMeeting ? (
                                            <div className="py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                                                <span className="block font-medium text-gray-500 dark:text-gray-400 mb-1">פגישה:</span>
                                                <div className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-200">
                                                    <span className="font-medium truncate">{latestMeeting.title}</span>
                                                    <span className="text-xs text-gray-500">{new Date(latestMeeting.startTime).toLocaleDateString('he-IL')} <span dir="ltr">{new Date(latestMeeting.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span></span>
                                                </div>
                                            </div>
                                        ) : null;
                                    })()}
                                    {showTasks && (
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-gray-500 dark:text-gray-400">משימות פתוחות</span>
                                                {openTasks.length > 0 && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{openTasks.length}</span>}
                                            </div>
                                            {openTasks.length > 0 ? (
                                                <ul className="space-y-1.5">
                                                    {openTasks.map(task => (
                                                        <li key={task.id} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0"></div>
                                                            <span className="line-clamp-2"><LinkifiedContent content={task.text} /></span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">אין משימות פתוחות</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }) : (
                        <p className="text-center p-8 text-gray-400 flex flex-col items-center">
                            <Search className="w-10 h-10 mb-2 opacity-50" />
                            {entityLabels.noEntities}
                        </p>
                    )}
                </div>
            </div >

            {/* Bulk Edit Modal */}
            <BulkEditModal
                isOpen={isBulkEditOpen}
                onClose={() => setIsBulkEditOpen(false)}
                selectedClients={selectedClients}
                onComplete={handleBulkEditComplete}
            />
        </>
    );
};