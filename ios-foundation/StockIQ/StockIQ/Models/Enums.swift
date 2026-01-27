// Enums.swift
// StockIQ

import SwiftUI

// MARK: - Checklist Status

enum ChecklistStatus: String, Codable, CaseIterable {
    case safe
    case warning
    case danger
    case unavailable

    var color: Color {
        switch self {
        case .safe: return .green
        case .warning: return .orange // Better visibility in light mode
        case .danger: return .red
        case .unavailable: return .secondary
        }
    }

    var icon: String {
        switch self {
        case .safe: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .danger: return "xmark.circle.fill"
        case .unavailable: return "questionmark.circle.fill"
        }
    }
}

// MARK: - Catalyst Event Type

enum CatalystEventType: String, Codable, CaseIterable {
    case earnings
    case earningsCall = "earnings_call"
    case exDividend = "ex_dividend"
    case dividendPayment = "dividend_payment"
    case stockSplit = "stock_split"
    case reverseSplit = "reverse_split"
    case analystRating = "analyst_rating"
    case clinicalTrial = "clinical_trial"
    case clinicalReadout = "clinical_readout"
    case clinicalMilestone = "clinical_milestone"
    case fdaApproval = "fda_approval"
    case fdaDesignation = "fda_designation"
    case fdaRejection = "fda_rejection"
    case adcom
    case pdufaDate = "pdufa_date"
    case ndaBlaSubmission = "nda_bla_submission"
    case secFiling = "sec_filing"
    case insiderTransaction = "insider_transaction"
    case executiveChange = "executive_change"
    case acquisition
    case partnership

    var displayName: String {
        switch self {
        case .earnings: return "Earnings"
        case .earningsCall: return "Earnings Call"
        case .exDividend: return "Ex-Dividend"
        case .dividendPayment: return "Dividend"
        case .stockSplit: return "Stock Split"
        case .reverseSplit: return "Reverse Split"
        case .analystRating: return "Analyst Rating"
        case .clinicalTrial: return "Clinical Trial"
        case .clinicalReadout: return "Data Readout"
        case .clinicalMilestone: return "Trial Milestone"
        case .fdaApproval: return "FDA Approval"
        case .fdaDesignation: return "FDA Designation"
        case .fdaRejection: return "FDA Rejection"
        case .adcom: return "AdCom Meeting"
        case .pdufaDate: return "PDUFA Date"
        case .ndaBlaSubmission: return "NDA/BLA Filing"
        case .secFiling: return "SEC Filing"
        case .insiderTransaction: return "Insider Trade"
        case .executiveChange: return "Executive Change"
        case .acquisition: return "Acquisition"
        case .partnership: return "Partnership"
        }
    }

    var icon: String {
        switch self {
        case .earnings, .earningsCall: return "chart.bar.fill"
        case .exDividend, .dividendPayment: return "dollarsign.circle.fill"
        case .stockSplit: return "arrow.up.right.and.arrow.down.left"
        case .reverseSplit: return "arrow.down.left.and.arrow.up.right"
        case .analystRating: return "star.fill"
        case .clinicalTrial, .clinicalReadout, .clinicalMilestone: return "cross.case.fill"
        case .fdaApproval, .pdufaDate, .fdaDesignation: return "checkmark.seal.fill"
        case .fdaRejection: return "xmark.seal.fill"
        case .adcom: return "person.3.fill"
        case .ndaBlaSubmission: return "doc.badge.arrow.up.fill"
        case .secFiling: return "doc.text.fill"
        case .insiderTransaction: return "person.badge.plus"
        case .executiveChange: return "person.2.fill"
        case .acquisition: return "building.2.fill"
        case .partnership: return "link"
        }
    }

    var color: Color {
        switch self {
        case .earnings, .earningsCall: return .blue
        case .exDividend, .dividendPayment: return .green
        case .stockSplit: return .purple
        case .reverseSplit: return .orange
        case .analystRating: return .mint
        case .clinicalTrial, .clinicalReadout, .clinicalMilestone: return .pink
        case .fdaApproval, .pdufaDate, .fdaDesignation, .adcom, .ndaBlaSubmission: return .pink
        case .fdaRejection: return .red
        case .secFiling: return .secondary
        case .insiderTransaction: return .indigo
        case .executiveChange: return .brown
        case .acquisition, .partnership: return .teal
        }
    }
}

// MARK: - Catalyst Source

enum CatalystSource: String, Codable {
    case yahoo
    case sec
    case clinicaltrials
    case finnhub

    var displayName: String {
        switch self {
        case .yahoo: return "Yahoo Finance"
        case .sec: return "SEC EDGAR"
        case .clinicaltrials: return "ClinicalTrials.gov"
        case .finnhub: return "Finnhub"
        }
    }
}

// MARK: - Auth Provider

enum AuthProvider: String, Codable {
    case google
    case github
    case apple
}
