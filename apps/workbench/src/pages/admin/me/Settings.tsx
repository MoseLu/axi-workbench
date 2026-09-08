import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Compatibility route for bookmarks created by the retired settings table.
 * Settings are now provided by the Cool Admin-style topbar panel and the
 * dedicated theme page, so this route must not render a second settings list.
 */
const Settings: React.FC = () => <Navigate replace to="/admin/me/theme" />;

export default Settings;
