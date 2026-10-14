import React from 'react';
import { ThemePicker } from './_components/ThemePicker';
import './Theme.css';

/**
 * Page-level view for the theme preference page.
 *
 * The actual mode picker (including i18n wiring) lives in
 * `./_components/ThemePicker.tsx`. This view is a thin wrapper so it only
 * imports a same-directory component and stays free of 3-layer cross-layer
 * imports.
 */
const Theme: React.FC = () => <ThemePicker />;

export default Theme;
