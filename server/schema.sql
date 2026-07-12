-- Database Schema Definition for Bank of Uganda (BoU) and Telecom Compliance Backend

-- Drop tables if they exist for clean execution
DROP TABLE IF EXISTS SLA_Audit_Logs CASCADE;
DROP TABLE IF EXISTS Complaints CASCADE;
DROP TABLE IF EXISTS Subscribers CASCADE;

-- Drop enums if they exist
DROP TYPE IF EXISTS WALLET_PROVIDER CASCADE;
DROP TYPE IF EXISTS LANGUAGE_PREF CASCADE;
DROP TYPE IF EXISTS COMPLAINT_CATEGORY CASCADE;
DROP TYPE IF EXISTS COMPLAINT_STATUS CASCADE;

-- Create ENUMS
CREATE TYPE WALLET_PROVIDER AS ENUM ('mtn', 'airtel');
CREATE TYPE LANGUAGE_PREF AS ENUM ('en', 'lg', 'rny');
CREATE TYPE COMPLAINT_CATEGORY AS ENUM ('sim_swap', 'voice_scam', 'overcharge');
CREATE TYPE COMPLAINT_STATUS AS ENUM ('pending_recording', 'under_review', 'resolved', 'escalated');

-- 1. Subscribers Table
CREATE TABLE Subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE NOT NULL, -- e.g., +256772123456
    identity_imsi VARCHAR(30) UNIQUE NOT NULL, -- International Mobile Subscriber Identity
    language_preference LANGUAGE_PREF DEFAULT 'en',
    primary_wallet_provider WALLET_PROVIDER NOT NULL,
    wallet_frozen BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Complaints Table
CREATE TABLE Complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_reference VARCHAR(30) UNIQUE NOT NULL, -- e.g., BOU-2026-004821
    subscriber_id UUID NOT NULL REFERENCES Subscribers(id) ON DELETE CASCADE,
    network_provider WALLET_PROVIDER NOT NULL,
    category COMPLAINT_CATEGORY NOT NULL,
    raw_audio_url TEXT,
    initial_transcript TEXT,
    corrected_transcript TEXT,
    status COMPLAINT_STATUS DEFAULT 'under_review' NOT NULL,
    district VARCHAR(50) NOT NULL, -- e.g. Kampala, Gulu, Masaka
    channel_source VARCHAR(10) NOT NULL, -- ussd, ivr, sms, app, pwa
    amount_ugx DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    sla_deadline TIMESTAMP NOT NULL, -- Calculated as created_at + 48 Hours
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. SLA Audit Logs Table
CREATE TABLE SLA_Audit_Logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES Complaints(id) ON DELETE CASCADE,
    action_taken VARCHAR(100) NOT NULL, -- e.g., 'wallet_freeze', 'flash_sms_intercept', 'resolve_dispute'
    operator_identity VARCHAR(100) NOT NULL, -- ID of the agent performing the action
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indices for performance optimization
CREATE INDEX idx_subscribers_phone ON Subscribers(phone_number);
CREATE INDEX idx_complaints_network ON Complaints(network_provider);
CREATE INDEX idx_complaints_status ON Complaints(status);
CREATE INDEX idx_complaints_sla_deadline ON Complaints(sla_deadline);
CREATE INDEX idx_audit_logs_complaint ON SLA_Audit_Logs(complaint_id);

-- 4. PWA Ingested Complaints Table
CREATE TABLE IF NOT EXISTS PWA_Complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_reference VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    category VARCHAR(30) NOT NULL,
    provider VARCHAR(30) NOT NULL,
    transaction_id VARCHAR(100),
    narrative TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'ingested' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. PWA Chat Messages Table
CREATE TABLE IF NOT EXISTS PWA_Chat_Messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_reference VARCHAR(50) NOT NULL REFERENCES PWA_Complaints(ticket_reference) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'citizen', 'operator'
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- PWA Indices
CREATE INDEX idx_pwa_complaints_phone ON PWA_Complaints(phone_number);
CREATE INDEX idx_pwa_complaints_ticket ON PWA_Complaints(ticket_reference);
CREATE INDEX idx_pwa_chat_ticket ON PWA_Chat_Messages(ticket_reference);
