// FIX: Removed 'Status' from import as it is no longer exported from '../types'. Client statuses are now string literals.
import { Client, CustomFieldDefinition, Automation, CustomFieldType } from '../types';

export const initialCustomFields: CustomFieldDefinition[] = [
  { id: 'field_1', name: 'טלפון', type: CustomFieldType.PHONE, showInGrid: true, showInList: true, showInCard: true, order: 1 },
  { id: 'field_2', name: 'אימייל', type: CustomFieldType.EMAIL, showInGrid: true, showInList: true, showInCard: true, order: 2 },
  { id: 'field_3', name: 'כתובת אתר', type: CustomFieldType.URL, showInGrid: false, showInList: true, showInCard: true, order: 3 },
];

export const initialClients: Client[] = [
  {
    id: 'client_1',
    name: 'ישראל ישראלי',
    // FIX: Replaced 'Status.NEW' with a string literal to align with the updated type where client status is a string.
    status: 'חדש',
    notes: 'לקוח פוטנציאלי, יצר קשר דרך האתר.',
    tasks: [
      { id: 'task_1', text: 'ליצור קשר ראשוני', isCompleted: false },
      { id: 'task_2', text: 'לשלוח הצעת מחיר', isCompleted: false },
    ],
    customFields: {
      'field_1': '050-1234567',
      'field_2': 'israel@israeli.co.il',
      'field_3': 'https://israeli.co.il'
    },
    comments: [],
  },
  {
    id: 'client_2',
    name: 'דנה כהן',
    // FIX: Replaced 'Status.IN_PROGRESS' with a string literal.
    status: 'בטיפול',
    notes: 'מתעניינת בשירותי עיצוב. יש לקבוע פגישת אפיון.',
    tasks: [
        { id: 'task_3', text: 'לקבוע פגישת זום', isCompleted: true },
        { id: 'task_4', text: 'להכין מצגת', isCompleted: false },
    ],
    customFields: {
      'field_1': '052-7654321',
      'field_2': 'dana@cohen.com',
    },
    comments: [],
  },
    {
    id: 'client_3',
    name: 'אבי לוי',
    // FIX: Replaced 'Status.ON_HOLD' with a string literal.
    status: 'בהמתנה',
    notes: 'מחכה לאישור תקציב מההנהלה. לעקוב בעוד שבוע.',
    tasks: [],
    customFields: {
      'field_1': '053-9876543',
    },
    comments: [],
  },
];

export const initialAutomations: Automation[] = [];