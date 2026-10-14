import React from 'react';
import { NotificationRow } from './_components/NotificationRow';
import './Notifications.css';

/**
 * Page-level view for the notifications inbox.
 *
 * The actual inbox UI (including i18n wiring, react-query, mutations,
 * table columns, and all states) lives in `./_components/NotificationRow.tsx`.
 * This view is a thin wrapper so it only imports a same-directory
 * component and stays free of 3-layer cross-layer imports.
 */
const Notifications: React.FC = () => <NotificationRow />;

export default Notifications;
