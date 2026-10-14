import React from 'react';
import { ProfileForm } from './_components/ProfileForm';
import './AccountInfo.css';

/**
 * Page-level view for the personal information form.
 *
 * The actual form (including AuthContext / i18n / last-account wiring) lives
 * in `./_components/ProfileForm.tsx`. This view is a thin wrapper so it only
 * imports a same-directory component and stays free of 3-layer cross-layer
 * imports.
 */
const AccountInfo: React.FC = () => <ProfileForm />;

export default AccountInfo;
