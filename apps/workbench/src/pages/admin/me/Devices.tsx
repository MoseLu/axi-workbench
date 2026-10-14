import React from 'react';
import { DeviceCard } from './_components/DeviceCard';

/**
 * Page-level view for the device management page.
 *
 * The actual mobile-pairing UI (including i18n / lib helpers) lives in
 * `./_components/DeviceCard.tsx`. This view is a thin wrapper so it only
 * imports a same-directory component and stays free of 3-layer cross-layer
 * imports.
 */
const Devices: React.FC = () => <DeviceCard />;

export default Devices;
