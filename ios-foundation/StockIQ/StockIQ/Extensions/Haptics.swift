// Haptics.swift
// StockIQ

import UIKit

enum Haptics {
    /// Light tap - for subtle feedback (toggles, selections)
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    /// Medium tap - for standard interactions (button taps)
    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    /// Heavy tap - for significant actions (delete, major state changes)
    static func heavy() {
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }

    /// Success notification - for completed actions
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    /// Warning notification - for caution states
    static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }

    /// Error notification - for failed actions
    static func error() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }

    /// Selection changed - for picker/segment changes
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}
