// Double+Formatting.swift
// StockIQ

import Foundation

extension Double {

    /// Format as currency: "$1,234.56"
    var asCurrency: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "en_US")
        return formatter.string(from: NSNumber(value: self)) ?? "$\(self)"
    }

    /// Format as percentage: "+12.34%" or "-5.67%"
    var asPercent: String {
        let sign = self >= 0 ? "+" : ""
        return String(format: "%@%.2f%%", sign, self)
    }

    /// Format as percentage without sign: "12.34%"
    var asPercentUnsigned: String {
        String(format: "%.2f%%", abs(self))
    }

    /// Format as compact number: "1.2B", "500M", "10K"
    var asCompact: String {
        let absValue = abs(self)
        let sign = self < 0 ? "-" : ""

        switch absValue {
        case 1_000_000_000_000...:
            return "\(sign)\(String(format: "%.1fT", absValue / 1_000_000_000_000))"
        case 1_000_000_000...:
            return "\(sign)\(String(format: "%.1fB", absValue / 1_000_000_000))"
        case 1_000_000...:
            return "\(sign)\(String(format: "%.1fM", absValue / 1_000_000))"
        case 1_000...:
            return "\(sign)\(String(format: "%.1fK", absValue / 1_000))"
        default:
            return "\(sign)\(String(format: "%.0f", absValue))"
        }
    }

    /// Format as compact currency: "$1.2B", "$500M"
    var asCompactCurrency: String {
        "$\(abs(self).asCompact)"
    }

    /// Format as ratio: "5.2x"
    var asRatio: String {
        String(format: "%.1fx", self)
    }

    /// Format with specified decimal places
    func formatted(decimals: Int) -> String {
        String(format: "%.\(decimals)f", self)
    }
}

extension Int {

    /// Format with thousands separator: "1,234,567"
    var withCommas: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: self)) ?? "\(self)"
    }

    /// Format as compact: "1.2M", "500K"
    var asCompact: String {
        Double(self).asCompact
    }
}

extension Optional where Wrapped == Double {

    /// Format or return placeholder
    func formatted(or placeholder: String = "—") -> String {
        guard let value = self else { return placeholder }
        return value.asCurrency
    }

    func asPercent(or placeholder: String = "—") -> String {
        guard let value = self else { return placeholder }
        return value.asPercent
    }

    func asCompact(or placeholder: String = "—") -> String {
        guard let value = self else { return placeholder }
        return value.asCompact
    }
}
