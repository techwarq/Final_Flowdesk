import React from 'react';

export type Platform = 'flipkart' | 'shopsy';
export type LoginType = 'email' | 'mobile';
export type AccountStatus =
    | 'New'
    | 'Healthy'
    | 'NeedsRefresh'
    | 'OTPRequired'
    | 'Locked'
    | 'Error';

export type UserRole = 'admin' | 'staff' | 'user';

export interface Account {
    id: string;
    platform: Platform;
    loginType: LoginType;
    identifier: string;
    status: AccountStatus;
    assignedTo?: string;
    lastLoginAt?: string;
    lastValidateAt?: string;
    errorCode?: string;
    createdAt: string;
    updatedAt: string;
    details?: {
        name?: string;
        mobile?: string;
        email?: string;
        superCoins?: string;
        isPlus?: boolean;
        gvBalance?: string;
    };
    orders?: Order[];
}

export interface Order {
    orderId: string;
    productName: string;
    status: string;
    deliveryDate: string;
    imageUrl?: string;
    price?: string;
    orderUrl: string;
    otp?: string;
    receiverName?: string;
    trackingId?: string;
    deliveryDetails?: string;
    sku?: string;
    seller?: string;
}

export interface UserProfile {
    id: string;
    username: string;
    role: UserRole;
    allowedAccounts?: number;
    createdAt?: string;
}

export interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    badge?: string;
}

// Batch Order Fetching Types
export interface BatchJob {
    jobId: string;
    status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
    total: number;
    completed: number;
    failed: number;
    startedAt?: string;
    completedAt?: string;
    results: BatchAccountResult[];
    errors: { accountId: string; error: string }[];
}

export interface BatchAccountResult {
    accountId: string;
    platform: Platform;
    status: 'pending' | 'running' | 'done' | 'error';
    ordersFound: number;
    gvBalance?: string;
    error?: string;
}
