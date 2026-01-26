// DateFormatter+StockIQ.swift
// StockIQ

import Foundation

extension DateFormatter {

    /// Format: "2025-01-15" (API date format)
    static let apiDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    /// Format: "Jan 15, 2025"
    static let displayDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// Format: "Jan 15"
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    /// Format: "January 2025"
    static let monthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter
    }()
}

extension Date {

    /// Format as API date string "2025-01-15"
    var apiDateString: String {
        DateFormatter.apiDate.string(from: self)
    }

    /// Format as display date "Jan 15, 2025"
    var displayString: String {
        DateFormatter.displayDate.string(from: self)
    }

    /// Format as short date "Jan 15"
    var shortString: String {
        DateFormatter.shortDate.string(from: self)
    }

    /// Relative description: "Today", "Tomorrow", "In 3 days", "5 days ago"
    var relativeString: String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(self) {
            return "Today"
        }
        if calendar.isDateInTomorrow(self) {
            return "Tomorrow"
        }
        if calendar.isDateInYesterday(self) {
            return "Yesterday"
        }

        let days = calendar.dateComponents([.day], from: now, to: self).day ?? 0

        if days > 0 {
            return days == 1 ? "In 1 day" : "In \(days) days"
        } else {
            let absDays = abs(days)
            return absDays == 1 ? "1 day ago" : "\(absDays) days ago"
        }
    }

    /// Check if date is in the future
    var isFuture: Bool {
        self > Date()
    }

    /// Check if date is today or in the future
    var isTodayOrFuture: Bool {
        Calendar.current.isDateInToday(self) || isFuture
    }
}
